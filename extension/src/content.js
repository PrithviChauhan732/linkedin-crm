/**
 * LinkedIn CRM — Content Script
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
let observer        = null;
let currentUrl      = window.location.href;
let currentConversation = null;
let campaignRunning = false; // guard against duplicate executions

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
    campaignRunning = false; // reset guard on navigation
    onPageChange();
  }
}, 250);

// ── Page routing ──────────────────────────────────────────────────────────────
function onPageChange() {
  const path = window.location.pathname;
  if (path.startsWith('/messaging')) {
    setupMessagingPage();
  } else if (path.startsWith('/in/')) {
    setupProfilePage();
  }
  // On every page: LinkedIn injects a messaging tray in the bottom-right.
  // Watch for it so we can sync replies even from the feed/home page.
  watchForMessagingTray();
}

// LinkedIn shows a messaging tray on ALL pages (feed, profile, etc.).
// When it appears, sync conversations from it — this catches replies without
// requiring the user to navigate to /messaging.
let trayObserverActive = false;
function watchForMessagingTray() {
  if (trayObserverActive) return;
  trayObserverActive = true;

  // The tray conversation list or individual chat bubbles
  const TRAY_SELECTORS = [
    '.msg-overlay-list-bubble',          // conversation list in tray
    '.msg-overlay-bubble-header',        // individual open chat
    '.msg-s-message-list-container',     // open message thread
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
        // Re-watch for future navigation
        setTimeout(() => { trayObserverActive = false; watchForMessagingTray(); }, 10000);
        return;
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

// Sync from the tray (bottom-right chat bubbles on feed/profile pages).
// Each open chat bubble contains sender name + latest message.
function syncConversationsFromTray() {
  const conversations = [];

  // Open chat threads in the tray
  document.querySelectorAll('.msg-overlay-conversation-bubble').forEach(bubble => {
    const nameEl   = bubble.querySelector('.msg-overlay-bubble-header__title');
    const link     = bubble.querySelector('a[href*="messaging"]');
    if (!nameEl) return;

    // Determine if the last message was from them (not us)
    const msgs    = bubble.querySelectorAll('.msg-s-message-list__event');
    const lastMsg = msgs[msgs.length - 1];
    const isOwn   = lastMsg?.classList.contains('msg-s-event-listitem--sent');
    const preview = lastMsg?.querySelector('.msg-s-event-listitem__body')?.textContent?.trim() || '';

    const threadId = link?.href?.match(/thread=([^&]+)/)?.[1]
                   || link?.href?.match(/\/messaging\/thread\/([^/]+)/)?.[1]
                   || null;

    conversations.push({
      name:       nameEl.textContent.trim(),
      preview,
      isUnread:   !isOwn && !!preview, // if last message isn't ours, it's a reply
      threadId,
      profileUrl: null, // tray doesn't expose profile URL directly
    });
  });

  if (conversations.length > 0) {
    safeSend({ type: 'SYNC_CONVERSATIONS', data: conversations });
  }
}

// ── Message Handler ───────────────────────────────────────────────────────────
function handleMessage(msg, _sender, sendResponse) {
  switch (msg.type) {

    // ── Campaign send (pushed by background via tabs.onUpdated) ───────────────
    case 'EXECUTE_CAMPAIGN_SEND':
      if (campaignRunning) { sendResponse({ ok: true, skipped: 'already running' }); break; }
      campaignRunning = true;
      console.log('[LCRM] EXECUTE_CAMPAIGN_SEND →', msg.pending?.username);
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
      // Profile page: click "Message" button to open compose
      if (!document.querySelector(SEL.composeBox)) {
        console.log('[LCRM] step 1: clicking Message button');
        await clickMessageButton();
      }

      // Wait up to 3s for either the compose box to appear HERE, or a page navigation.
      // If LinkedIn navigates to /messaging/thread/new/, background.tabs.onUpdated will
      // push EXECUTE_CAMPAIGN_SEND to the new page — we just need to exit cleanly here.
      const outcome = await waitForComposeOrNavigation(startUrl, 3000);
      if (outcome === 'navigated') {
        console.log('[LCRM] navigated to messaging page — background will re-push to new page');
        campaignRunning = false;
        return;
      }
    }

    // On messaging page (or compose appeared on profile): wait for compose box
    console.log('[LCRM] step 2: waiting for compose box');
    await waitForElementAsync(SEL.composeBox, 15000);

    console.log('[LCRM] step 3: sending message');
    await sleep(800);
    const result = await sendLinkedInMessage(pending.message);
    console.log('[LCRM] result:', result);

    campaignRunning = false;
    safeSend({
      type:       'CAMPAIGN_MESSAGE_RESULT',
      contactId:  pending.contactId,
      campaignId: pending.campaignId,
      result,
    });
  } catch (e) {
    console.error('[LCRM] executeCampaignSend error:', e);
    campaignRunning = false;
    safeSend({
      type:       'CAMPAIGN_MESSAGE_RESULT',
      contactId:  pending.contactId,
      campaignId: pending.campaignId,
      result:     { success: false, error: e.message },
    });
  }
}

// Resolves 'compose' if compose box appeared, 'navigated' if URL changed first.
function waitForComposeOrNavigation(startUrl, timeout) {
  return new Promise(resolve => {
    if (document.querySelector(SEL.composeBox)) { resolve('compose'); return; }

    const interval = setInterval(() => {
      if (window.location.href !== startUrl) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve('navigated');
        return;
      }
      if (document.querySelector(SEL.composeBox)) {
        clearInterval(interval);
        clearTimeout(timer);
        resolve('compose');
      }
    }, 200);

    const timer = setTimeout(() => {
      clearInterval(interval);
      resolve('navigated'); // assume navigated if no compose appeared
    }, timeout);
  });
}

async function clickMessageButton() {
  console.log('[LCRM] clickMessageButton: searching...');

  for (let attempt = 0; attempt < 25; attempt++) {
    await sleep(400);

    // LinkedIn renders "Message Firstname" as an <a href="/messaging/compose/?profileUrn=...">
    // Programmatic .click() is blocked by LinkedIn's isTrusted check, so we navigate directly.
    const msgLink = [...document.querySelectorAll('a')].find(a => {
      const text = a.textContent.replace(/\s+/g, ' ').trim();
      return text.startsWith('Message') && !text.includes('InMail') && a.href.includes('messaging/compose');
    });
    if (msgLink) {
      console.log('[LCRM] navigating to compose URL:', msgLink.href.slice(0, 60));
      window.location.href = msgLink.href;
      return; // page will navigate away; tabs.onUpdated will push EXECUTE_CAMPAIGN_SEND to new page
    }

    // Fallback: older LinkedIn used <button data-control-name="message">
    const dataBtn = document.querySelector('[data-control-name="message"], .message-anywhere-button');
    if (dataBtn) {
      console.log('[LCRM] clicking via data-control-name');
      dataBtn.click();
      return;
    }
  }
  throw new Error('Message link not found after 10s');
}

// ── LinkedIn message send ─────────────────────────────────────────────────────
async function sendLinkedInMessage(text) {
  const compose = document.querySelector(SEL.composeBox);
  if (!compose) return { success: false, error: 'Compose box not found' };

  compose.focus();
  await sleep(300);

  // Clear then insert — execCommand triggers React's onChange
  document.execCommand('selectAll', false, null);
  document.execCommand('delete', false, null);
  await sleep(100);
  document.execCommand('insertText', false, text);
  await sleep(600);

  // Verify text was inserted
  if (!compose.textContent.trim()) {
    return { success: false, error: 'Text insertion failed' };
  }

  // LinkedIn sends with Enter key (the send button is not always in the DOM).
  // Dispatch the full keydown → keypress → keyup sequence.
  const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  compose.dispatchEvent(new KeyboardEvent('keydown',  enterOpts));
  compose.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
  compose.dispatchEvent(new KeyboardEvent('keyup',    enterOpts));
  await sleep(1000);

  // Confirm message was sent: compose box should be empty
  const sent = compose.textContent.trim() === '';
  if (!sent) {
    // Fallback: try clicking the send button if it appeared
    const sendBtn = document.querySelector(SEL.sendBtn) ||
      [...document.querySelectorAll('button')].find(b => /^send$/i.test(b.textContent.trim()));
    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      await sleep(800);
      return { success: compose.textContent.trim() === '', error: 'Used send button fallback' };
    }
    return { success: false, error: 'Message may not have sent — compose not cleared' };
  }

  return { success: true };
}

// ── Profile Page ──────────────────────────────────────────────────────────────
let currentProfileContact = null;

function setupProfilePage() {
  document.getElementById('lcrm-badge')?.remove();

  const username = window.location.href.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  if (!username) return;

  currentProfileContact = {
    name:       username,
    headline:   '',
    profileUrl: `https://www.linkedin.com/in/${username}`,
    username,
    addedAt:    new Date().toISOString(),
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
  if (currentUsername !== contact.username) return; // User navigated away to a different profile

  const name     = findProfileName();
  const headline = (
    document.querySelector('.text-body-medium.break-words') ||
    document.querySelector('.pv-text-details__left-panel .text-body-medium') ||
    document.querySelector('[data-anonymize="person-tagline"]')
  )?.textContent?.trim() || '';
  const company = (
    document.querySelector('.pv-text-details__right-panel .text-body-medium') ||
    document.querySelector('[aria-label*="Current company"]')
  )?.textContent?.trim() || '';
  const location = (
    document.querySelector('.pv-text-details__left-panel .text-body-small.inline') ||
    document.querySelector('[data-anonymize="location"]') ||
    document.querySelector('.top-card-layout__first-subtext')
  )?.textContent?.trim() || '';
  const mutualConnection = (
    document.querySelector('a[href*="facetNetwork"]')?.textContent?.trim() ||
    document.querySelector('.member-insights__reason-text')?.textContent?.trim() ||
    document.querySelector('.pv-member-insights__reason-text')?.textContent?.trim() || ''
  ).replace(/\s+/g, ' ');

  if (name) {
    contact.name     = name;
    contact.headline = headline;
    contact.company  = company;
    if (location) contact.location = location;
    if (mutualConnection) contact.mutualConnection = mutualConnection;
    currentProfileContact = contact;

    const badge = document.getElementById('lcrm-badge');
    if (badge) {
      badge.querySelector('#lcrm-name').textContent = name;
    } else {
      injectProfileBadge(contact);
    }
    safeSend({ type: 'PROFILE_VIEWED', data: contact });
  } else if (attempt < 25) {
    setTimeout(() => enrichFromDOM(contact, attempt + 1), 350);
  } else {
    if (headline) {
      contact.headline = headline;
      contact.company  = company;
      if (location) contact.location = location;
      if (mutualConnection) contact.mutualConnection = mutualConnection;
    }
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
    <div style="opacity:.8;font-size:11px;margin-top:2px">Add to group ▸</div>
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
  const items = document.querySelectorAll(SEL.convItem);
  const conversations = [];

  items.forEach(item => {
    const nameEl   = item.querySelector('.msg-conversation-listitem__link .truncate span:first-child');
    const preview  = item.querySelector('.msg-conversation-listitem__message-snippet');
    const time     = item.querySelector('.msg-conversation-listitem__time-stamp');
    const isUnread = item.classList.contains('msg-conversation-listitem--unread');
    const link     = item.querySelector('a');
    if (!nameEl) return;

    const threadId = link?.href?.match(/thread=([^&]+)/)?.[1]
                  || link?.href?.match(/\/messaging\/thread\/([^/]+)/)?.[1]
                  || null;

    conversations.push({
      name:       nameEl.textContent.trim(),
      preview:    preview?.textContent.trim() || '',
      time:       time?.textContent.trim() || '',
      isUnread,
      threadId,
      profileUrl: link?.href || null,
    });
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
    const body   = msg.querySelector('.msg-s-event-listitem__body');
    const sender = msg.querySelector('.msg-s-message-group__meta .truncate');
    const time   = msg.querySelector('time');
    if (!body) return;
    messages.push({
      text:      body.textContent.trim(),
      sender:    sender?.textContent.trim() || 'unknown',
      timestamp: time?.getAttribute('datetime') || new Date().toISOString(),
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

// Promise-based waitForElement — throws on timeout
function waitForElementAsync(selector, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) { resolve(el); return; }
    const obs = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { obs.disconnect(); clearTimeout(timer); resolve(found); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      obs.disconnect();
      reject(new Error(`Timed out waiting for ${selector}`));
    }, timeout);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
