/**
 * LinkedIn CRM — Content Script
 * Handles: messaging sync, profile badge, company page prompt, people scraper
 */

const API_BASE = 'http://localhost:4000/api';

const SEL = {
  composeBox: '.msg-form__contenteditable',
  sendBtn:    '.msg-form__send-button',
  convList:   '.msg-conversations-container__conversations-list',
  convItem:   '.msg-conversation-listitem',
};

const NAME_SELECTORS = [
  'h1.text-heading-xlarge',
  'h1.inline.t-24.t-black.t-normal',
  'h1[data-anonymize="person-name"]',
  '.pv-top-card--list h1',
  '.top-card-layout__title',
  '.profile-topcard-person-entity__name',
  'main h1',
  'h1',
];

// ── State ─────────────────────────────────────────────────────────────────────
let observer              = null;
let currentUrl            = window.location.href;
let currentConversation   = null;
let campaignRunning       = false;
let trayObserverActive    = false;
let currentProfileContact = null;

// ── Extension context guard ───────────────────────────────────────────────────
function isContextValid() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function safeSend(msg, callback) {
  try {
    if (isContextValid()) {
      if (callback) {
        chrome.runtime.sendMessage(msg, callback);
      } else {
        chrome.runtime.sendMessage(msg);
      }
    }
  } catch {}
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (isContextValid()) {
  chrome.runtime.onMessage.addListener(handleMessage);
  onPageChange();
  watchConnectButton();
}

// ── SPA navigation watcher ────────────────────────────────────────────────────
const navTimer = setInterval(() => {
  if (!isContextValid()) { clearInterval(navTimer); return; }
  const href = window.location.href;
  if (href !== currentUrl) {
    currentUrl = href;
    campaignRunning = false;
    onPageChange();
  }
}, 250);

// ── Page routing ──────────────────────────────────────────────────────────────
function onPageChange() {
  // Remove any existing injected panels on nav
  document.getElementById('lcrm-badge')?.remove();
  document.getElementById('lcrm-company-widget')?.remove();
  document.getElementById('lcrm-people-panel')?.remove();

  const path = window.location.pathname;

  if (path.startsWith('/messaging')) {
    setupMessagingPage();
  } else if (/^\/company\/[^/]+\/people/.test(path)) {
    // People tab MUST be checked before generic company page
    setTimeout(setupPeoplePage, 1800);
  } else if (/^\/company\/[^/]+/.test(path)) {
    setTimeout(setupCompanyPage, 1200);
  } else if (path.startsWith('/in/')) {
    setupProfilePage();
  } else if (path.replace(/\/$/, '') === '/mynetwork/invite-connect/connections') {
    setTimeout(scrapeConnectionsPage, 2000);
  }

  watchForMessagingTray();
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY PAGE — Floating widget to save company to CRM
// ═══════════════════════════════════════════════════════════════════════════════
function scrapeCompanyData() {
  const slug = window.location.pathname.match(/\/company\/([^/?#]+)/)?.[1] || '';
  const name = (
    document.querySelector('h1.org-top-card-summary__title') ||
    document.querySelector('.org-top-card-primary-content__title') ||
    document.querySelector('h1[data-anonymize="company-name"]') ||
    document.querySelector('.top-card-layout__title') ||
    document.querySelector('main h1')
  )?.textContent?.trim() || slug;

  const tagline = (
    document.querySelector('.org-top-card-summary__tagline') ||
    document.querySelector('.org-top-card-primary-content__tagline')
  )?.textContent?.trim() || '';

  const industry = (
    document.querySelector('.org-top-card-summary-info-list__info-item') ||
    document.querySelector('[data-test-id="about-us__industry"]')
  )?.textContent?.trim() || '';

  const size = (
    [...document.querySelectorAll('.org-top-card-summary-info-list__info-item')]
      .find(el => /employee/i.test(el.textContent))
  )?.textContent?.trim() || '';

  const location = (
    document.querySelector('.org-top-card-summary-info-list__info-item:last-child') ||
    document.querySelector('[data-test-id="about-us__headquarters"]')
  )?.textContent?.trim() || '';

  const website = (
    document.querySelector('a[data-test-id="about-us__website"]')?.href ||
    document.querySelector('.org-page-details__website a')?.href || ''
  );

  return {
    name,
    slug,
    linkedinUrl: `https://www.linkedin.com/company/${slug}`,
    tagline,
    industry,
    size,
    location,
    website,
  };
}

async function setupCompanyPage() {
  if (document.getElementById('lcrm-company-widget')) return;
  const company = scrapeCompanyData();
  if (!company.name) return;

  // Fetch groups and campaigns from backend
  let groups = [], campaigns = [];
  try {
    await new Promise(resolve => {
      safeSend({ type: 'FETCH_API', path: '/groups' }, gRes => {
        groups = gRes?.data?.groups || [];
        safeSend({ type: 'FETCH_API', path: '/campaigns' }, cRes => {
          campaigns = cRes?.data?.campaigns || [];
          resolve();
        });
      });
    });
  } catch {}

  injectCompanyWidget(company, groups, campaigns);
}

function injectCompanyWidget(company, groups, campaigns) {
  const w = document.createElement('div');
  w.id = 'lcrm-company-widget';
  w.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:2147483647;
    background:#0f172a;border:1px solid #1e3a5f;border-radius:16px;
    padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;color:#e2e8f0;box-shadow:0 8px 32px rgba(0,0,0,.6);
    min-width:280px;max-width:320px;
  `;

  const groupOptions = groups.map(g =>
    `<option value="${g._id}">${g.name}</option>`
  ).join('');

  const campaignOptions = campaigns.map(c =>
    `<option value="${c._id}">${c.name}</option>`
  ).join('');

  w.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div>
        <div style="font-weight:700;font-size:14px;color:#f8fafc;">${company.name}</div>
        ${company.tagline ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">${company.tagline.slice(0, 60)}</div>` : ''}
      </div>
      <button id="lcrm-cw-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 8px;">✕</button>
    </div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
      ${company.industry ? `<span style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:2px 8px;font-size:10px;color:#94a3b8;">${company.industry}</span>` : ''}
      ${company.size     ? `<span style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:2px 8px;font-size:10px;color:#94a3b8;">${company.size}</span>` : ''}
      ${company.location ? `<span style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:2px 8px;font-size:10px;color:#94a3b8;">${company.location}</span>` : ''}
    </div>

    <div style="margin-bottom:10px;">
      <label style="display:block;font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Save to Group</label>
      <select id="lcrm-cw-group" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:7px 10px;color:#e2e8f0;font-size:12px;outline:none;">
        <option value="">— No Group —</option>
        ${groupOptions}
      </select>
    </div>

    <div id="lcrm-cw-status" style="font-size:11px;color:#22d3ee;min-height:16px;margin-bottom:10px;"></div>

    <button id="lcrm-cw-save" style="width:100%;background:#2563eb;border:none;border-radius:10px;padding:9px;color:white;font-size:12px;font-weight:700;cursor:pointer;transition:background .2s;">
      Add Company to CRM
    </button>

    ${campaigns.length ? `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #1e293b;">
      <a href="${company.linkedinUrl}/people" style="display:block;text-align:center;font-size:11px;color:#818cf8;text-decoration:none;font-weight:600;">
        View People at ${company.name} →
      </a>
    </div>` : ''}
  `;

  document.body.appendChild(w);

  document.getElementById('lcrm-cw-close').onclick = () => w.remove();
  document.getElementById('lcrm-cw-save').onclick = async () => {
    const groupId  = document.getElementById('lcrm-cw-group').value || null;
    const statusEl = document.getElementById('lcrm-cw-status');
    const btn      = document.getElementById('lcrm-cw-save');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    safeSend({
      type: 'ADD_COMPANY',
      data: { ...company, groupId },
    });

    statusEl.textContent = 'Company saved to CRM!';
    btn.textContent = 'Saved';
    btn.style.background = '#059669';
    setTimeout(() => w.remove(), 2000);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEOPLE PAGE — Scrape employee cards, build checklist, add to campaign
// ═══════════════════════════════════════════════════════════════════════════════
function scrapeVisiblePeople() {
  const people = [];
  const companySlug = window.location.pathname.match(/\/company\/([^/?#]+)/)?.[1] || '';
  const companyName = (
    document.querySelector('h1.org-top-card-summary__title') ||
    document.querySelector('.org-top-card-primary-content__title') ||
    document.querySelector('main h1')
  )?.textContent?.trim() || companySlug;

  // People cards on the /people tab
  const cardSelectors = [
    '.org-people-profile-card',
    '.org-people-profiles-module__profile-list-item',
    '[data-view-name="profile-entity-lockup"]',
    '.artdeco-entity-lockup',
  ];

  const mainContainer = document.querySelector('.scaffold-layout__main') || document.querySelector('main') || document;

  for (const sel of cardSelectors) {
    const cards = mainContainer.querySelectorAll(sel);
    if (!cards.length) continue;

    cards.forEach(card => {
      // 1. Ignore cards inside the sidebar or right rail
      if (card.closest('aside, .aside, .org-sidebar, .right-rail, [data-view-name*="viewed"]')) {
        return;
      }

      // 2. Get the primary link of the card, strictly ensuring it's a person's profile
      const primaryLinkEl = card.querySelector(
        '.artdeco-entity-lockup__title a[href*="/in/"], ' +
        '.org-people-profile-card__profile-title a[href*="/in/"], ' +
        'a.app-aware-link[href*="/in/"]'
      );
      if (!primaryLinkEl) return;

      const href = primaryLinkEl.getAttribute('href') || '';
      const isProfileLink = href.includes('/in/') && !href.includes('/company/');
      if (!isProfileLink) return;

      const nameEl = card.querySelector(
        '.artdeco-entity-lockup__title span[aria-hidden="true"],' +
        '.org-people-profile-card__profile-title,' +
        '.artdeco-entity-lockup__title,' +
        'span[data-anonymize="person-name"]'
      );
      const roleEl = card.querySelector(
        '.artdeco-entity-lockup__subtitle span[aria-hidden="true"],' +
        '.org-people-profile-card__profile-position,' +
        '.artdeco-entity-lockup__subtitle,' +
        'span[data-anonymize="title"]'
      );

      const name = nameEl?.textContent?.trim();
      if (!name || name.length < 2) return;

      const profileUrl = primaryLinkEl.href.startsWith('http')
        ? primaryLinkEl.href
        : `https://www.linkedin.com${primaryLinkEl.href}`;

      people.push({
        name,
        headline: roleEl?.textContent?.trim() || '',
        company:  companyName,
        profileUrl,
      });
    });
    if (people.length > 0) break; // found cards, stop trying selectors
  }

  return { people, companyName };
}

async function setupPeoplePage() {
  if (document.getElementById('lcrm-people-panel')) return;

  // Wait for people cards to load
  await new Promise(resolve => {
    const check = () => {
      const found = document.querySelector('.org-people-profile-card, .artdeco-entity-lockup');
      if (found) resolve();
      else setTimeout(check, 600);
    };
    check();
    setTimeout(resolve, 8000); // fallback
  });

  const { people, companyName } = scrapeVisiblePeople();

  // Fetch campaigns for the dropdown
  let campaigns = [];
  let groups    = [];
  try {
    await new Promise(resolve => {
      safeSend({ type: 'FETCH_API', path: '/campaigns' }, cRes => {
        campaigns = cRes?.data?.campaigns || [];
        safeSend({ type: 'FETCH_API', path: '/groups' }, gRes => {
          groups = gRes?.data?.groups || [];
          resolve();
        });
      });
    });
  } catch {}

  injectPeoplePanel(people, companyName, campaigns, groups);
}

function injectPeoplePanel(people, companyName, campaigns, groups) {
  const panel = document.createElement('div');
  panel.id = 'lcrm-people-panel';
  panel.style.cssText = `
    position:fixed;right:0;top:0;bottom:0;z-index:2147483647;
    background:#0f172a;border-left:1px solid #1e3a5f;
    width:340px;display:flex;flex-direction:column;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:13px;color:#e2e8f0;box-shadow:-8px 0 32px rgba(0,0,0,.5);
    overflow:hidden;
  `;

  const campaignOptions = campaigns.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  const groupOptions    = groups.map(g => `<option value="${g._id}">${g.name}</option>`).join('');

  const peopleRows = people.map((p, i) => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid #1e293b;" class="lcrm-person-row">
      <input type="checkbox" value="${i}" checked style="margin-top:6px;accent-color:#3b82f6;cursor:pointer;" class="lcrm-person-checkbox" />
      <div style="min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;">
        <input type="text" value="${escapeHtml(p.name)}" class="lcrm-person-name-input" data-idx="${i}" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:4px;padding:4px 6px;color:#f1f5f9;font-size:12px;outline:none;" />
        ${p.headline ? `<div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.headline)}</div>` : ''}
        ${p.profileUrl ? `<a href="${p.profileUrl}" target="_blank" rel="noopener" style="font-size:10px;color:#60a5fa;text-decoration:none;align-self:flex-start;">View Profile →</a>` : ''}
      </div>
    </div>
  `).join('');

  panel.innerHTML = `
    <!-- Header -->
    <div style="padding:16px;border-bottom:1px solid #1e293b;background:#0a0f1e;shrink:0;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:800;font-size:14px;color:#f8fafc;">People at ${escapeHtml(companyName)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px;">${people.length} visible · select contacts to add</div>
        </div>
        <button id="lcrm-pp-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;line-height:1;">✕</button>
      </div>

      <!-- Select All + Scrape More -->
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button id="lcrm-pp-selectall" style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:6px;color:#94a3b8;font-size:11px;font-weight:600;cursor:pointer;">
          Select All (${people.length})
        </button>
        <button id="lcrm-pp-scrapemore" style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:6px;color:#818cf8;font-size:11px;font-weight:600;cursor:pointer;">
          Scroll &amp; Load More
        </button>
      </div>
    </div>

    <!-- People List -->
    <div id="lcrm-pp-list" style="flex:1;overflow-y:auto;">
      ${people.length > 0 ? peopleRows : '<div style="padding:40px 16px;text-align:center;color:#475569;font-size:12px;">No people cards detected yet.<br>Try scrolling down first.</div>'}
    </div>

    <!-- Footer Actions -->
    <div style="padding:14px 16px;border-top:1px solid #1e293b;background:#0a0f1e;shrink:0;display:flex;flex-direction:column;gap:10px;">
      <div>
        <label style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px;">Add to Group</label>
        <select id="lcrm-pp-group" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:7px 10px;color:#e2e8f0;font-size:12px;outline:none;">
          <option value="">— No Group —</option>
          ${groupOptions}
        </select>
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:5px;">Add to Campaign</label>
        <select id="lcrm-pp-campaign" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:7px 10px;color:#e2e8f0;font-size:12px;outline:none;">
          <option value="">— No Campaign —</option>
          ${campaignOptions}
        </select>
      </div>
      <div id="lcrm-pp-status" style="font-size:11px;color:#22d3ee;min-height:14px;text-align:center;"></div>
      <button id="lcrm-pp-save" style="width:100%;background:#2563eb;border:none;border-radius:10px;padding:10px;color:white;font-size:12px;font-weight:700;cursor:pointer;">
        Add Selected to CRM
      </button>
    </div>
  `;

  document.body.appendChild(panel);

  // Offset page body so panel doesn't overlap
  document.body.style.marginRight = '340px';
  document.body.style.transition  = 'margin-right 0.25s ease';

  // Close
  document.getElementById('lcrm-pp-close').onclick = () => {
    panel.remove();
    document.body.style.marginRight = '';
  };

  // Select all toggle
  let allSelected = true;
  document.getElementById('lcrm-pp-selectall').onclick = () => {
    allSelected = !allSelected;
    panel.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = allSelected);
    document.getElementById('lcrm-pp-selectall').textContent =
      allSelected ? `Deselect All` : `Select All (${people.length})`;
  };

  // Scroll & load more
  document.getElementById('lcrm-pp-scrapemore').onclick = async () => {
    const btn = document.getElementById('lcrm-pp-scrapemore');
    btn.textContent = 'Scrolling...';
    btn.disabled = true;

    // Auto-scroll the page to load more LinkedIn cards
    for (let i = 0; i < 6; i++) {
      window.scrollBy(0, 600);
      await sleep(900);
    }
    window.scrollTo(0, 0);
    await sleep(1000);

    // Re-scrape
    const { people: freshPeople } = scrapeVisiblePeople();
    const list = document.getElementById('lcrm-pp-list');
    if (freshPeople.length > people.length) {
      // Append new cards
      freshPeople.slice(people.length).forEach((p, i) => {
        const idx = people.length + i;
        people.push(p);
        const div = document.createElement('div');
        div.innerHTML = `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid #1e293b;" class="lcrm-person-row">
            <input type="checkbox" value="${idx}" checked style="margin-top:6px;accent-color:#3b82f6;cursor:pointer;" class="lcrm-person-checkbox" />
            <div style="min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;">
              <input type="text" value="${escapeHtml(p.name)}" class="lcrm-person-name-input" data-idx="${idx}" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:4px;padding:4px 6px;color:#f1f5f9;font-size:12px;outline:none;" />
              ${p.headline ? `<div style="font-size:11px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.headline)}</div>` : ''}
              ${p.profileUrl ? `<a href="${p.profileUrl}" target="_blank" rel="noopener" style="font-size:10px;color:#60a5fa;text-decoration:none;align-self:flex-start;">View Profile →</a>` : ''}
            </div>
          </div>`;
        list.appendChild(div.firstElementChild);
      });
      document.getElementById('lcrm-pp-status').textContent = `Loaded ${freshPeople.length} people total.`;
    } else {
      document.getElementById('lcrm-pp-status').textContent = 'No new people found.';
    }
    btn.textContent = 'Scroll & Load More';
    btn.disabled = false;
  };

  // Save selected contacts
  document.getElementById('lcrm-pp-save').onclick = async () => {
    const checked = [...panel.querySelectorAll('.lcrm-person-checkbox:checked')].map(cb => {
      const idx = +cb.value;
      const person = people[idx];
      if (!person) return null;
      const input = panel.querySelector(`.lcrm-person-name-input[data-idx="${idx}"]`);
      return {
        ...person,
        name: input ? input.value.trim() : person.name
      };
    }).filter(Boolean);

    const campaignId = document.getElementById('lcrm-pp-campaign').value || null;
    const groupId    = document.getElementById('lcrm-pp-group').value    || null;
    const statusEl   = document.getElementById('lcrm-pp-status');
    const btn        = document.getElementById('lcrm-pp-save');

    if (!checked.length) { statusEl.textContent = 'Select at least one person.'; return; }

    btn.textContent = `Saving ${checked.length} contacts...`;
    btn.disabled    = true;
    statusEl.textContent = '';

    safeSend({ type: 'ADD_PEOPLE_TO_CRM', data: { contacts: checked, campaignId, groupId } });

    statusEl.textContent = `${checked.length} contacts saved!`;
    btn.textContent = 'Saved';
    btn.style.background = '#059669';
    setTimeout(() => {
      btn.textContent = `Add Selected to CRM`;
      btn.style.background = '#2563eb';
      btn.disabled = false;
    }, 3000);
  };
}

function escapeHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGING TRAY WATCHER
// ═══════════════════════════════════════════════════════════════════════════════
function watchForMessagingTray() {
  if (trayObserverActive) return;
  trayObserverActive = true;

  const TRAY_SELECTORS = [
    '.msg-overlay-list-bubble',
    '.msg-overlay-bubble-header',
    '.msg-s-message-list-container',
  ];

  function onTrayReady() {
    syncConversationsFromTray();
  }

  const obs = new MutationObserver(() => {
    for (const sel of TRAY_SELECTORS) {
      if (document.querySelector(sel)) {
        obs.disconnect();
        trayObserverActive = false;
        onTrayReady();
        setTimeout(() => { trayObserverActive = false; watchForMessagingTray(); }, 10000);
        return;
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

function syncConversationsFromTray() {
  const conversations = [];

  document.querySelectorAll('.msg-overlay-conversation-bubble').forEach(bubble => {
    const nameEl = bubble.querySelector('.msg-overlay-bubble-header__title');
    const link   = bubble.querySelector('a[href*="messaging"]');
    if (!nameEl) return;

    const msgs    = bubble.querySelectorAll('.msg-s-message-list__event');
    const lastMsg = msgs[msgs.length - 1];
    const isOwn   = lastMsg?.classList.contains('msg-s-event-listitem--sent');
    const preview = lastMsg?.querySelector('.msg-s-event-listitem__body')?.textContent?.trim() || '';
    const threadId = link?.href?.match(/thread=([^&]+)/)?.[1]
                   || link?.href?.match(/\/messaging\/thread\/([^/]+)/)?.[1]
                   || null;

    conversations.push({
      name: nameEl.textContent.trim(),
      preview,
      isUnread: !isOwn && !!preview,
      threadId,
      profileUrl: null,
    });
  });

  if (conversations.length > 0) {
    safeSend({ type: 'SYNC_CONVERSATIONS', data: conversations });
  }
}

// ── Message Handler ───────────────────────────────────────────────────────────
function handleMessage(msg, _sender, sendResponse) {
  switch (msg.type) {
    case 'GET_PAGE_CONTEXT': {
      const path = window.location.pathname;
      const companySlug = path.match(/\/company\/([^/?#]+)/)?.[1];
      if (companySlug) {
        const nameEl = document.querySelector('h1.org-top-card-summary__title, .org-top-card-primary-content__title, main h1');
        const subEl  = document.querySelector('.org-top-card-summary-info-list__info-item');
        sendResponse({ name: nameEl?.textContent?.trim() || companySlug, sub: subEl?.textContent?.trim() || '' });
      } else if (currentProfileContact?.name) {
        sendResponse({ name: currentProfileContact.name, sub: currentProfileContact.headline || '', ...currentProfileContact });
      } else {
        sendResponse({ name: '', sub: '' });
      }
      break;
    }

    case 'EXECUTE_CAMPAIGN_SEND':
      if (campaignRunning) { sendResponse({ ok: true, skipped: 'already running' }); break; }
      campaignRunning = true;
      executeCampaignSend(msg.pending)
        .then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'SEND_SINGLE_MESSAGE':
      sendLinkedInMessage(msg.text).then(sendResponse);
      return true;

    case 'GET_CONVERSATIONS':
      syncConversations();
      sendResponse({ ok: true });
      break;

    case 'SET_CURRENT_THREAD':
      currentConversation = msg.threadId;
      extractCurrentMessages();
      sendResponse({ ok: true });
      break;
  }
}

// ── Campaign Send Flow ────────────────────────────────────────────────────────
async function executeCampaignSend(pending) {
  const startUrl = window.location.href;

  try {
    const onMessaging = window.location.pathname.startsWith('/messaging');
    if (!onMessaging) {
      if (!document.querySelector(SEL.composeBox)) {
        await clickMessageButton();
      }
      const outcome = await waitForComposeOrNavigation(startUrl, 3000);
      if (outcome === 'navigated') { campaignRunning = false; return; }
    }

    await waitForElementAsync(SEL.composeBox, 15000);
    await sleep(800);
    const result = await sendLinkedInMessage(pending.message);

    campaignRunning = false;
    safeSend({ type: 'CAMPAIGN_MESSAGE_RESULT', contactId: pending.contactId, campaignId: pending.campaignId, result });
  } catch (e) {
    console.error('[LCRM] executeCampaignSend error:', e);
    campaignRunning = false;
    safeSend({ type: 'CAMPAIGN_MESSAGE_RESULT', contactId: pending.contactId, campaignId: pending.campaignId, result: { success: false, error: e.message } });
  }
}

function waitForComposeOrNavigation(startUrl, timeout) {
  return new Promise(resolve => {
    if (document.querySelector(SEL.composeBox)) { resolve('compose'); return; }
    const interval = setInterval(() => {
      if (window.location.href !== startUrl) { clearInterval(interval); clearTimeout(timer); resolve('navigated'); return; }
      if (document.querySelector(SEL.composeBox)) { clearInterval(interval); clearTimeout(timer); resolve('compose'); }
    }, 200);
    const timer = setTimeout(() => { clearInterval(interval); resolve('navigated'); }, timeout);
  });
}

async function clickMessageButton() {
  for (let attempt = 0; attempt < 25; attempt++) {
    await sleep(400);
    const msgLink = [...document.querySelectorAll('a')].find(a => {
      const text = a.textContent.replace(/\s+/g, ' ').trim();
      return text.startsWith('Message') && !text.includes('InMail') && a.href.includes('messaging/compose');
    });
    if (msgLink) { window.location.href = msgLink.href; return; }
    const dataBtn = document.querySelector('[data-control-name="message"], .message-anywhere-button');
    if (dataBtn) { dataBtn.click(); return; }
  }
  throw new Error('Message link not found after 10s');
}

async function sendLinkedInMessage(text) {
  const compose = document.querySelector(SEL.composeBox);
  if (!compose) return { success: false, error: 'Compose box not found' };
  compose.focus();
  await sleep(300);
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(100);
  document.execCommand('insertText', false, text);
  await sleep(600);
  if (!compose.textContent.trim()) return { success: false, error: 'Text insertion failed' };
  const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  compose.dispatchEvent(new KeyboardEvent('keydown',  enterOpts));
  compose.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
  compose.dispatchEvent(new KeyboardEvent('keyup',    enterOpts));
  await sleep(1000);
  const sent = compose.textContent.trim() === '';
  if (!sent) {
    const sendBtn = document.querySelector(SEL.sendBtn) ||
      [...document.querySelectorAll('button')].find(b => /^send$/i.test(b.textContent.trim()));
    if (sendBtn && !sendBtn.disabled) { sendBtn.click(); await sleep(800); return { success: compose.textContent.trim() === '' }; }
    return { success: false, error: 'Compose not cleared' };
  }
  return { success: true };
}

// ── Profile Page ──────────────────────────────────────────────────────────────
function setupProfilePage() {
  const username = window.location.href.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  if (!username) return;
  currentProfileContact = {
    name: username, headline: '', profileUrl: `https://www.linkedin.com/in/${username}`, username, addedAt: new Date().toISOString(),
  };
  // Don't inject badge yet — enrichFromDOM calls injectProfileBadge once name/role/company are scraped
  enrichFromDOM(currentProfileContact);
}

function findProfileName() {
  for (const sel of NAME_SELECTORS) {
    const text = document.querySelector(sel)?.textContent?.trim();
    if (text?.length > 1) return text;
  }
  return '';
}

function getConnectionStatus() {
  const dist = document.querySelector('.dist-value, .pv-member-badge__distance')?.textContent?.trim() || '';
  if (dist.includes('1st')) return 'connected';
  
  const buttons = Array.from(document.querySelectorAll('button, a'));
  const btnTexts = buttons.map(b => b.textContent?.trim()?.toLowerCase() || '');
  const ariaLabels = buttons.map(b => b.getAttribute('aria-label')?.toLowerCase() || '');
  
  const hasPending = btnTexts.some(t => t.includes('pending') || t.includes('invitation') || t.includes('invite sent')) || 
                     ariaLabels.some(a => a.includes('pending') || a.includes('invitation') || a.includes('invite sent'));
  if (hasPending) return 'connection_sent';

  const hasConnect = btnTexts.some(t => t.includes('connect')) || ariaLabels.some(a => a.includes('connect'));
  if (dist.includes('2nd') || dist.includes('3rd') || hasConnect) {
    return 'new';
  }

  // If "Message" is primary and no "Connect", likely connected
  const hasMessage = btnTexts.some(t => t.includes('message')) || ariaLabels.some(a => a.includes('message'));
  if (hasMessage) {
    return 'connected';
  }

  return 'new';
}

async function fetchContactInfo(contact) {
  try {
    const url = window.location.href.split('?')[0].replace(/\/+$/, '') + '/overlay/contact-info/';
    const res = await fetch(url);
    if (!res.ok) return contact;
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const sections = Array.from(doc.querySelectorAll('section'));
    let email = '';
    let phone = '';
    let website = '';
    
    sections.forEach(sec => {
      const text = sec.textContent || '';
      const h3 = (sec.querySelector('h3') || sec.querySelector('h4') || sec.querySelector('header') || sec.querySelector('.pv-contact-info__header'))?.textContent || '';
      
      if (h3.includes('Email') || text.includes('Email') || sec.className.includes('email')) {
        const mailto = sec.querySelector('a[href^="mailto:"]');
        if (mailto) email = mailto.textContent.trim();
      }
      if (h3.includes('Phone') || text.includes('Phone') || sec.className.includes('phone')) {
        const phoneSpan = sec.querySelector('ul li span') || sec.querySelector('span');
        if (phoneSpan) phone = phoneSpan.textContent.trim();
      }
      if (h3.includes('Website') || text.includes('Website') || sec.className.includes('website')) {
        const webLink = sec.querySelector('a');
        if (webLink) {
          let link = webLink.href;
          try {
            const parsed = new URL(link);
            if (parsed.searchParams.has('url')) {
              link = parsed.searchParams.get('url');
            }
          } catch(e) {}
          website = link;
        }
      }
    });
    
    if (email) contact.email = email;
    if (phone) contact.phone = phone;
    if (website) contact.website = website;
  } catch (err) {
    console.error('Error fetching contact info overlay:', err);
  }
  return contact;
}

// ── Headline / Role ──────────────────────────────────────────────────────────
// Module-scope so the patch interval can call it without closure issues.
function scrapeHeadline() {
  // Strategy 1: explicit data-anonymize attr (LinkedIn A/B variant)
  const tag = document.querySelector('[data-anonymize="person-tagline"]');
  if (tag?.textContent?.trim()) return tag.textContent.trim();

  // Strategy 2: the .break-words span directly after the h1 (most common)
  const h1 = document.querySelector('h1');
  if (h1) {
    let sibling = h1.nextElementSibling;
    while (sibling) {
      const t = sibling.textContent?.trim();
      if (t && t.length > 2) return t;
      sibling = sibling.nextElementSibling;
    }
    // Also try the parent container's first eligible text node after h1
    const parent = h1.parentElement;
    if (parent) {
      const kids = Array.from(parent.querySelectorAll('div, span')).filter(el => {
        const t = el.textContent?.trim();
        return t && t.length > 3 && !el.querySelector('h1') && el !== h1;
      });
      if (kids[0]?.textContent?.trim()) return kids[0].textContent.trim();
    }
  }

  // Strategy 3: class-based selectors (several LinkedIn variants)
  const selectors = [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel .text-body-medium',
    'main .ph5 .text-body-medium',
    '.artdeco-card .text-body-medium',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t && t.length > 2) return t;
  }
  return '';
}

// ── Company ───────────────────────────────────────────────────────────────────
function scrapeCompany() {
  // Strategy 1: explicit ARIA label
  const ariaEl = document.querySelector('[aria-label*="Current company"], [aria-label*="current company"]');
  if (ariaEl?.textContent?.trim()) return ariaEl.textContent.trim();

  // Strategy 2: right panel of top card
  const rightPanel = document.querySelector('.pv-text-details__right-panel');
  if (rightPanel) {
    // spans with aria-hidden="true" are the visible text spans LinkedIn uses
    const spans = Array.from(rightPanel.querySelectorAll('span[aria-hidden="true"]'))
      .filter(s => s.textContent.trim().length > 1);
    if (spans[0]?.textContent?.trim()) return spans[0].textContent.trim();
    // Generic span fallback
    const allSpans = Array.from(rightPanel.querySelectorAll('span'))
      .filter(s => !s.classList.contains('visually-hidden') && s.textContent.trim().length > 1);
    if (allSpans[0]?.textContent?.trim()) return allSpans[0].textContent.trim();
  }

  // Strategy 3: "Works at" or experience section
  const expSelectors = [
    '.pvs-list__item--line-separated .hoverable-link-text span[aria-hidden="true"]',
    '.pv-profile-section__card-item .pv-entity__secondary-title span:last-child',
    '.experience-section .pv-entity__company-summary-info h3 span:last-child',
  ];
  for (const sel of expSelectors) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }
  return '';
}

function enrichFromDOM(contact, attempt = 0) {
  const currentUsername = window.location.href.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  if (currentUsername !== contact.username) return;

  const name     = findProfileName();

  const headline = scrapeHeadline();
  const company  = scrapeCompany();

  const location = (document.querySelector('.pv-text-details__left-panel .text-body-small.inline') || document.querySelector('[data-anonymize="location"]'))?.textContent?.trim() || '';
  const connectionStatus = getConnectionStatus();

  // Scrape mutual connections
  let mutualConnection = '';
  const mutualEl = Array.from(document.querySelectorAll('a, span, p')).find(el => 
    el.textContent.includes('mutual connection') || el.textContent.includes('Mutual connection')
  );
  if (mutualEl) {
    mutualConnection = mutualEl.textContent.trim().replace(/\s+/g, ' ');
  }

  // Scrape recent post topic
  let recentPostTopic = '';
  const postEl = document.querySelector('.feed-shared-update-v2__description-text, .pv-recent-activity-detail__text, .pv-recent-activity-detail__title');
  if (postEl) {
    recentPostTopic = postEl.textContent.trim().replace(/\s+/g, ' ');
    if (recentPostTopic.length > 100) {
      recentPostTopic = recentPostTopic.substring(0, 97) + '...';
    }
  }

  if (name) {
    contact.name = name; 
    contact.headline = headline; 
    contact.company = company; 
    contact.connectionStatus = connectionStatus;
    if (location) contact.location = location;
    if (mutualConnection) contact.mutualConnection = mutualConnection;
    if (recentPostTopic) contact.recentPostTopic = recentPostTopic;
    
    // Re-inject badge with enriched data (name/role/company now populated)
    injectProfileBadge(contact);
    
    // If headline or company were empty, keep polling the DOM and patch the inputs in-place
    if (!headline || !company) {
      let patchAttempts = 0;
      const patchInterval = setInterval(() => {
        patchAttempts++;
        const liveHeadline = scrapeHeadline();
        const liveCompany  = scrapeCompany();
        const headlineInput = document.getElementById('lcrm-badge-headline-input');
        const companyInput  = document.getElementById('lcrm-badge-company-input');
        if (headlineInput && liveHeadline && !headlineInput.value) {
          headlineInput.value = liveHeadline;
          contact.headline = liveHeadline;
        }
        if (companyInput && liveCompany && !companyInput.value) {
          companyInput.value = liveCompany;
          contact.company = liveCompany;
        }
        if ((headlineInput?.value && companyInput?.value) || patchAttempts > 13) {
          clearInterval(patchInterval);
        }
      }, 600);
    }
    
    // Enrich with contact-info overlay (email/phone) but do NOT auto-save to backend
    fetchContactInfo(contact).then((enrichedContact) => {
      currentProfileContact = enrichedContact;
    }).catch(() => {
      currentProfileContact = contact;
    });
  } else if (attempt < 25) {
    setTimeout(() => enrichFromDOM(contact, attempt + 1), 350);
  } else {
    if (headline) { 
      contact.headline = headline; 
      contact.company = company; 
      contact.connectionStatus = connectionStatus; 
      if (location) contact.location = location;
      if (mutualConnection) contact.mutualConnection = mutualConnection;
      if (recentPostTopic) contact.recentPostTopic = recentPostTopic;
    }
    // Inject badge even in fallback case so widget always appears
    injectProfileBadge(contact);
    fetchContactInfo(contact).then((enrichedContact) => {
      currentProfileContact = enrichedContact;
    }).catch(() => {
      currentProfileContact = contact;
    });
  }
}

async function injectProfileBadge(contact) {
  document.getElementById('lcrm-badge')?.remove();

  let campaigns = [];
  let groups    = [];
  let pipelines = [];

  // Try to fetch dropdowns — proceed immediately regardless
  try {
    const { token } = await new Promise(r => chrome.storage.local.get('token', r));
    if (token) {
      await new Promise(resolve => {
        safeSend({ type: 'FETCH_API', path: '/campaigns' }, cRes => {
          campaigns = cRes?.data?.campaigns || [];
          safeSend({ type: 'FETCH_API', path: '/groups' }, gRes => {
            groups = gRes?.data?.groups || [];
            safeSend({ type: 'FETCH_API', path: '/pipelines' }, pRes => {
              pipelines = pRes?.data?.pipelines || [];
              resolve();
            });
          });
        });
      });
    }
  } catch (err) {
    console.error('[WarmDM] Error loading options:', err);
  }

  const badge = document.createElement('div');
  badge.id = 'lcrm-badge';
  badge.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:2147483647;
    background:#0a0f1e;border:1px solid #1e293b;border-radius:12px;
    padding:16px;font-family:-apple-system,sans-serif;font-size:13px;
    box-shadow:0 8px 32px rgba(0,0,0,.5);width:280px;color:#e2e8f0;
  `;
  
  const campaignOptions = campaigns.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
  const groupOptions    = groups.map(g => {
    // Auto-select if company name matches group name
    const selected = (contact.company && g.name.toLowerCase() === contact.company.toLowerCase()) ? 'selected' : '';
    return `<option value="${g._id}" ${selected}>${g.name}</option>`;
  }).join('');
  const pipelineOptions = pipelines.map(p => {
    const selected = p.isDefault ? 'selected' : '';
    return `<option value="${p._id}" ${selected}>${p.name}${p.isDefault ? ' (Default)' : ''}</option>`;
  }).join('');

  badge.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;">
      <input type="text" id="lcrm-badge-name-input" value="${escapeHtml(contact.name)}" style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:6px;color:#f8fafc;font-size:12px;font-weight:600;outline:none;flex:1;min-width:0;" />
      <button id="lcrm-badge-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px;">✕</button>
    </div>

    <label style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;display:block;">Role</label>
    <input type="text" id="lcrm-badge-headline-input" value="${escapeHtml(contact.headline || '')}" placeholder="e.g. Sales Leader" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:6px;color:#cbd5e1;font-size:12px;margin-bottom:12px;outline:none;" />

    <label style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;display:block;">Company</label>
    <input type="text" id="lcrm-badge-company-input" value="${escapeHtml(contact.company || '')}" placeholder="e.g. Acme Corp" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:6px;color:#cbd5e1;font-size:12px;margin-bottom:12px;outline:none;" />
    
    <label style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;display:block;">Pipeline</label>
    <select id="lcrm-badge-pipeline" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:6px;color:#e2e8f0;font-size:12px;margin-bottom:12px;outline:none;">
      <option value="">— No Pipeline —</option>
      ${pipelineOptions}
    </select>

    <label style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;display:block;">Group</label>
    <select id="lcrm-badge-group" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:6px;color:#e2e8f0;font-size:12px;margin-bottom:12px;outline:none;">
      <option value="">— No Group —</option>
      ${groupOptions}
    </select>

    <label style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:4px;display:block;">Campaign</label>
    <select id="lcrm-badge-campaign" style="width:100%;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:6px;color:#e2e8f0;font-size:12px;margin-bottom:12px;outline:none;">
      <option value="">— No Campaign —</option>
      ${campaignOptions}
    </select>

    <div id="lcrm-badge-status" style="font-size:11px;color:#22d3ee;text-align:center;margin-bottom:8px;min-height:14px;"></div>
    <button id="lcrm-badge-save" style="width:100%;background:#2563eb;border:none;border-radius:6px;padding:8px;color:white;font-weight:600;cursor:pointer;">
      Save to CRM
    </button>
  `;

  document.body.appendChild(badge);

  // If dropdowns were empty (token not ready), retry populating them after 2s
  if (!campaigns.length && !groups.length && !pipelines.length) {
    setTimeout(async () => {
      const badgeEl = document.getElementById('lcrm-badge');
      if (!badgeEl) return; // badge was closed
      try {
        const { token } = await new Promise(r => chrome.storage.local.get('token', r));
        if (!token) return;
        await new Promise(resolve => {
          safeSend({ type: 'FETCH_API', path: '/campaigns' }, cRes => {
            const freshCampaigns = cRes?.data?.campaigns || [];
            safeSend({ type: 'FETCH_API', path: '/groups' }, gRes => {
              const freshGroups = gRes?.data?.groups || [];
              safeSend({ type: 'FETCH_API', path: '/pipelines' }, pRes => {
                const freshPipelines = pRes?.data?.pipelines || [];
                // Patch selects in-place
                const pSel = badgeEl.querySelector('#lcrm-badge-pipeline');
                const gSel = badgeEl.querySelector('#lcrm-badge-group');
                const cSel = badgeEl.querySelector('#lcrm-badge-campaign');
                if (pSel && freshPipelines.length) {
                  pSel.innerHTML = '<option value="">— No Pipeline —</option>' +
                    freshPipelines.map(p => `<option value="${p._id}"${p.isDefault ? ' selected' : ''}>${p.name}${p.isDefault ? ' (Default)' : ''}</option>`).join('');
                }
                if (gSel && freshGroups.length) {
                  gSel.innerHTML = '<option value="">— No Group —</option>' +
                    freshGroups.map(g => `<option value="${g._id}">${g.name}</option>`).join('');
                }
                if (cSel && freshCampaigns.length) {
                  cSel.innerHTML = '<option value="">— No Campaign —</option>' +
                    freshCampaigns.map(c => `<option value="${c._id}">${c.name}</option>`).join('');
                }
                resolve();
              });
            });
          });
        });
      } catch (e) { /* silently ignore */ }
    }, 2000);
  }

  badge.querySelector('#lcrm-badge-close').onclick = () => badge.remove();
  badge.querySelector('#lcrm-badge-save').onclick = () => {
    const groupId = badge.querySelector('#lcrm-badge-group').value;
    const campaignId = badge.querySelector('#lcrm-badge-campaign').value;
    const pipelineId = badge.querySelector('#lcrm-badge-pipeline').value;
    const statusEl = badge.querySelector('#lcrm-badge-status');
    const btn = badge.querySelector('#lcrm-badge-save');
    const customName = badge.querySelector('#lcrm-badge-name-input')?.value?.trim() || contact.name;
    const customHeadline = badge.querySelector('#lcrm-badge-headline-input')?.value?.trim() || contact.headline;
    const customCompany = badge.querySelector('#lcrm-badge-company-input')?.value?.trim() || contact.company;
    
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    // Determine status to send
    const dataToSend = { 
      ...currentProfileContact, 
      name: customName, 
      headline: customHeadline,
      company: customCompany,
      status: currentProfileContact.connectionStatus || 'new',
      pipelineId: pipelineId || null
    };
    
    safeSend({ type: 'ADD_PEOPLE_TO_CRM', data: {
      contacts: [dataToSend],
      groupId: groupId || null,
      campaignId: campaignId || null
    }}, res => {
      if (res?.ok) {
        statusEl.textContent = '✓ Saved successfully!';
        btn.textContent = '✓ Saved';
        setTimeout(() => badge.remove(), 2000);
      } else {
        statusEl.textContent = res?.error || 'Failed to save';
        btn.textContent = 'Retry';
        btn.disabled = false;
      }
    });
  };
}

// ── Messaging Page ────────────────────────────────────────────────────────────
function setupMessagingPage() {
  waitForElement(SEL.convList, () => {
    syncConversations();
    watchForNewMessages();
  });
}

function syncConversations() {
  const items = document.querySelectorAll('.msg-conversation-listitem, .msg-conversation-card, [data-control-name="conversation_item"]');
  const conversations = [];

  items.forEach(item => {
    const nameEl  = item.querySelector('.msg-conversation-listitem__link .truncate span:first-child') || item.querySelector('.msg-conversation-card__participant-names') || item.querySelector('.truncate');
    const preview = item.querySelector('.msg-conversation-listitem__message-snippet') || item.querySelector('.msg-conversation-card__message-snippet');
    const link    = item.querySelector('a');
    if (!nameEl) return;

    const isUnread = item.classList.contains('msg-conversation-listitem--unread') || item.className.includes('unread');
    const threadId = link?.href?.match(/thread=([^&]+)/)?.[1] || link?.href?.match(/\/messaging\/thread\/([^/]+)/)?.[1] || null;

    conversations.push({ name: nameEl.textContent.trim(), preview: preview?.textContent.trim() || '', isUnread, threadId, profileUrl: link?.href || null });
  });

  safeSend({ type: 'SYNC_CONVERSATIONS', data: conversations });
}

function watchForNewMessages() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => {
    syncConversations();
    if (currentConversation) extractCurrentMessages();
  });
  const target = document.querySelector(SEL.convList) || document.body;
  observer.observe(target, { childList: true, subtree: true });
}

function extractCurrentMessages() {
  const messages = [];
  document.querySelectorAll('.msg-s-message-list__event').forEach(msg => {
    const body = msg.querySelector('.msg-s-event-listitem__body');
    if (!body) return;
    messages.push({
      text:      body.textContent.trim(),
      sender:    msg.querySelector('.msg-s-message-group__meta .truncate')?.textContent?.trim() || 'unknown',
      timestamp: msg.querySelector('time')?.getAttribute('datetime') || new Date().toISOString(),
      isOwn:     msg.classList.contains('msg-s-event-listitem--sent'),
    });
  });
  safeSend({ type: 'MESSAGES_EXTRACTED', data: { threadId: currentConversation, messages } });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function waitForElement(selector, callback, timeout = 10000) {
  const el = document.querySelector(selector);
  if (el) { callback(el); return; }
  const obs = new MutationObserver(() => {
    const found = document.querySelector(selector);
    if (found) { obs.disconnect(); callback(found); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), timeout);
}

function waitForElementAsync(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }
    const obs = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { obs.disconnect(); clearTimeout(timer); resolve(found); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => { obs.disconnect(); reject(new Error(`Timed out waiting for ${selector}`)); }, timeout);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Connections Sync ──────────────────────────────────────────────────────────
async function scrapeConnectionsPage() {
  // Wait a bit for the list to render
  await sleep(2000);
  
  // Scroll down slightly to ensure connections load
  window.scrollTo(0, document.body.scrollHeight / 2);
  await sleep(1500);

  const cards = document.querySelectorAll('.mn-connection-card');
  const connections = [];

  cards.forEach(card => {
    const link = card.querySelector('a[href^="/in/"]');
    if (!link) return;
    
    const nameEl = card.querySelector('.mn-connection-card__name') || link.querySelector('.visually-hidden') || link;
    const name = nameEl.textContent.trim().replace('Member’s name', '').trim();
    const timeEl = card.querySelector('time');
    
    connections.push({
      name,
      profileUrl: link.href,
      time: timeEl ? timeEl.textContent.trim() : ''
    });
  });

  // Also try generic links if cards aren't found (LinkedIn A/B testing)
  if (connections.length === 0) {
    const links = document.querySelectorAll('li a[href^="/in/"]');
    links.forEach(link => {
      const name = link.textContent.trim();
      if (name && name.split(' ').length > 1) { // Basic filter to avoid non-name links
        connections.push({
          name,
          profileUrl: link.href
        });
      }
    });
  }

  // Deduplicate by URL
  const uniqueConns = [];
  const seenUrls = new Set();
  connections.forEach(c => {
    const url = c.profileUrl.split('?')[0];
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      uniqueConns.push(c);
    }
  });

  console.log('[WarmDM] Scraped connections:', uniqueConns.length);
  
  // Send back to background script to sync
  chrome.runtime.sendMessage({ type: 'SYNC_CONNECTIONS_DATA', data: uniqueConns });
}

function watchConnectButton() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button, a');
    if (!btn) return;
    
    const text = btn.textContent?.trim()?.toLowerCase() || '';
    const aria = btn.getAttribute('aria-label')?.toLowerCase() || '';
    
    if (text.includes('connect') || aria.includes('connect')) {
      console.log('[WarmDM] Connect button clicked, waiting to update status...');
      // Wait for LinkedIn UI to update to pending
      await sleep(1500);
      const newStatus = getConnectionStatus();
      if (newStatus === 'connection_sent' && currentProfileContact) {
        currentProfileContact.connectionStatus = 'connection_sent';
        const badge = document.getElementById('lcrm-badge');
        if (badge) {
          const statusEl = badge.querySelector('#lcrm-badge-status');
          if (statusEl) statusEl.textContent = 'Connection Sent!';
        }
        safeSend({ 
          type: 'PROFILE_VIEWED', 
          data: { ...currentProfileContact, connectionStatus: 'connection_sent' } 
        });
        console.log('[WarmDM] Status updated to connection_sent');
      }
    }
  });
}
