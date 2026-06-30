/**
 * LinkedIn CRM — Content Script
 * Handles: messaging sync, profile badge, company page prompt, people scraper
 */

const API_BASE = 'https://linkedin-crm-y0bz.onrender.com/api';

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

function safeSend(msg) {
  try { if (isContextValid()) chrome.runtime.sendMessage(msg); } catch {}
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if (isContextValid()) {
  chrome.runtime.onMessage.addListener(handleMessage);
  onPageChange();
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
    const { token } = await new Promise(r => chrome.storage.local.get('token', r));
    if (token) {
      const [gRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/groups`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/campaigns`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      groups    = (await gRes.json()).groups    || [];
      campaigns = (await cRes.json()).campaigns || [];
    }
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

  for (const sel of cardSelectors) {
    const cards = document.querySelectorAll(sel);
    if (!cards.length) continue;

    cards.forEach(card => {
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
      const linkEl = card.querySelector('a[href*="linkedin.com/in/"], a[href^="/in/"]');

      const name = nameEl?.textContent?.trim();
      if (!name || name.length < 2) return;

      const profileUrl = linkEl?.href
        ? (linkEl.href.startsWith('http') ? linkEl.href : `https://www.linkedin.com${linkEl.href}`)
        : '';

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
    const { token } = await new Promise(r => chrome.storage.local.get('token', r));
    if (token) {
      const [cRes, gRes] = await Promise.all([
        fetch(`${API_BASE}/campaigns`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/groups`,    { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      campaigns = (await cRes.json()).campaigns || [];
      groups    = (await gRes.json()).groups    || [];
    }
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
    <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid #1e293b;cursor:pointer;transition:background .15s;" 
           class="lcrm-person-row" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" value="${i}" checked style="margin-top:3px;accent-color:#3b82f6;cursor:pointer;" />
      <div style="min-width:0;flex:1;">
        <div style="font-weight:600;font-size:12px;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</div>
        ${p.headline ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.headline)}</div>` : ''}
        ${p.profileUrl ? `<a href="${p.profileUrl}" target="_blank" rel="noopener" style="font-size:10px;color:#60a5fa;text-decoration:none;">View Profile →</a>` : ''}
      </div>
    </label>
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
          <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid #1e293b;cursor:pointer;" class="lcrm-person-row">
            <input type="checkbox" value="${idx}" checked style="margin-top:3px;accent-color:#3b82f6;" />
            <div style="min-width:0;flex:1;">
              <div style="font-weight:600;font-size:12px;color:#f1f5f9;">${escapeHtml(p.name)}</div>
              ${p.headline ? `<div style="font-size:11px;color:#94a3b8;">${escapeHtml(p.headline)}</div>` : ''}
              ${p.profileUrl ? `<a href="${p.profileUrl}" target="_blank" style="font-size:10px;color:#60a5fa;text-decoration:none;">View Profile →</a>` : ''}
            </div>
          </label>`;
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
    const checked    = [...panel.querySelectorAll('input[type=checkbox]:checked')].map(cb => people[+cb.value]).filter(Boolean);
    const campaignId = document.getElementById('lcrm-pp-campaign').value || null;
    const groupId    = document.getElementById('lcrm-pp-group').value    || null;
    const statusEl   = document.getElementById('lcrm-pp-status');
    const btn        = document.getElementById('lcrm-pp-save');

    if (!checked.length) { statusEl.textContent = 'Select at least one person.'; return; }

    btn.textContent = `Saving ${checked.length} contacts...`;
    btn.disabled    = true;
    statusEl.textContent = '';

    safeSend({ type: 'ADD_PEOPLE_TO_CRM', data: { people: checked, campaignId, groupId } });

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
  injectProfileBadge(currentProfileContact);
  enrichFromDOM(currentProfileContact);
}

function findProfileName() {
  for (const sel of NAME_SELECTORS) {
    const text = document.querySelector(sel)?.textContent?.trim();
    if (text?.length > 1) return text;
  }
  return '';
}

function enrichFromDOM(contact, attempt = 0) {
  const currentUsername = window.location.href.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  if (currentUsername !== contact.username) return;

  const name     = findProfileName();
  const headline = (document.querySelector('.text-body-medium.break-words') || document.querySelector('[data-anonymize="person-tagline"]'))?.textContent?.trim() || '';
  const company  = (document.querySelector('.pv-text-details__right-panel .text-body-medium') || document.querySelector('[aria-label*="Current company"]'))?.textContent?.trim() || '';
  const location = (document.querySelector('.pv-text-details__left-panel .text-body-small.inline') || document.querySelector('[data-anonymize="location"]'))?.textContent?.trim() || '';

  if (name) {
    contact.name = name; contact.headline = headline; contact.company = company;
    if (location) contact.location = location;
    currentProfileContact = contact;
    const badge = document.getElementById('lcrm-badge');
    if (badge) badge.querySelector('#lcrm-name').textContent = name;
    else injectProfileBadge(contact);
    safeSend({ type: 'PROFILE_VIEWED', data: contact });
  } else if (attempt < 25) {
    setTimeout(() => enrichFromDOM(contact, attempt + 1), 350);
  } else {
    if (headline) { contact.headline = headline; contact.company = company; if (location) contact.location = location; }
    currentProfileContact = contact;
    safeSend({ type: 'PROFILE_VIEWED', data: contact });
  }
}

function injectProfileBadge(contact) {
  document.getElementById('lcrm-badge')?.remove();
  const badge = document.createElement('div');
  badge.id = 'lcrm-badge';
  badge.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:2147483647;
    background:#0a66c2;color:white;border-radius:8px;
    padding:10px 16px;font-family:-apple-system,sans-serif;font-size:13px;
    box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:pointer;min-width:160px;
  `;
  badge.innerHTML = `
    <div id="lcrm-name" style="font-weight:600">${contact.name}</div>
    <div style="opacity:.8;font-size:11px;margin-top:2px;">Add to group &rsaquo;</div>
  `;
  badge.addEventListener('click', () => {
    safeSend({ type: 'OPEN_ADD_TO_GROUP', data: currentProfileContact || contact });
  });
  document.body.appendChild(badge);
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
