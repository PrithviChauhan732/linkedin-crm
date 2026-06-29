/**
 * LinkedIn CRM — Background Service Worker
 */

const API_BASE = 'http://localhost:4000/api';

let campaign = null;

// ── Tab load listener (PRIMARY campaign trigger) ──────────────────────────────
// When the target LinkedIn profile page finishes loading, PUSH the campaign
// instruction to the content script. This is reliable because:
//   1. We know exactly when the page is ready (status === 'complete')
//   2. We send the message directly vs. content script polling storage
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = tab.url || '';
  if (!url.startsWith('https://www.linkedin.com/')) return;

  const { pendingCampaignSend } = await chrome.storage.session.get('pendingCampaignSend');
  if (!pendingCampaignSend) return;

  const isTargetProfile =
    url.includes(`/in/${pendingCampaignSend.username}`);

  // After clicking "Message" on a profile, LinkedIn often navigates to a new
  // thread page or compose page — handle both so we don't need the profile page.
  const isMessagingPage =
    url.includes('/messaging/thread/') ||
    url.includes('/messaging/compose') ||
    url.includes('/messaging/thread/new');

  if (!isTargetProfile && !isMessagingPage) return;

  // Give content script 1.5s to initialize, then push the send instruction
  setTimeout(() => pushCampaignSend(tabId, pendingCampaignSend), 1500);
});

function pushCampaignSend(tabId, pending, attempt = 0) {
  chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_CAMPAIGN_SEND', pending }, (res) => {
    if (chrome.runtime.lastError) {
      // Content script not ready yet — retry up to 3 times
      if (attempt < 3) {
        setTimeout(() => pushCampaignSend(tabId, pending, attempt + 1), 1500);
      }
    }
  });
}

// ── Message Router ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

    case 'SYNC_CONVERSATIONS':
      syncToBackend('/messages/sync-conversations', msg.data)
        .then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'MESSAGES_EXTRACTED':
      syncToBackend('/messages/sync-thread', msg.data)
        .then(() => sendResponse({ ok: true }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'PROFILE_VIEWED':
      syncToBackend('/contacts/upsert', msg.data)
        .then(res => sendResponse({ ok: true, contact: res }))
        .catch(e => sendResponse({ error: e.message }));
      return true;

    case 'CAMPAIGN_MESSAGE_RESULT':
      handleCampaignResult(msg.contactId, msg.campaignId, msg.result)
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'OPEN_ADD_TO_GROUP':
      chrome.tabs.create({
        url: `http://localhost:3000/contacts/add?name=${encodeURIComponent(msg.data.username || msg.data.name)}&url=${encodeURIComponent(msg.data.profileUrl)}`,
      });
      sendResponse({ ok: true });
      break;

    case 'FORWARD_TO_CONTENT': {
      const payload = msg.payload;
      if (payload.type === 'START_CAMPAIGN') {
        startCampaign(payload.queue);
        sendResponse({ started: true });
        return;
      }
      if (payload.type === 'STOP_CAMPAIGN') {
        stopCampaign();
        sendResponse({ stopped: true });
        return;
      }
      getLinkedInTab().then(tab => {
        if (!tab) { sendResponse({ error: 'No LinkedIn tab' }); return; }
        chrome.tabs.sendMessage(tab.id, payload, sendResponse);
      });
      return true;
    }
  }
});

// ── Campaign Execution ────────────────────────────────────────────────────────
function startCampaign(queue) {
  if (!queue?.length) return;
  campaign = { queue, index: 0, running: true };
  processNext();
}

function stopCampaign() {
  if (campaign) campaign.running = false;
  campaign = null;
  chrome.storage.session.remove(['pendingCampaignSend']);
}

async function processNext() {
  if (!campaign?.running) return;

  if (campaign.index >= campaign.queue.length) {
    await syncToBackend('/campaigns/complete', {}).catch(() => {});
    campaign = null;
    chrome.storage.session.remove(['pendingCampaignSend']);
    return;
  }

  const item     = campaign.queue[campaign.index];
  const username = item.profileUrl.match(/linkedin\.com\/in\/([^/?#]+)/)?.[1];
  if (!username) { campaign.index++; return processNext(); }

  const pending = {
    username,
    contactId:  String(item.contactId),
    campaignId: String(item.campaignId),
    message:    personalizeTemplate(item.template, item.contact),
  };

  await chrome.storage.session.set({ pendingCampaignSend: pending });

  // Navigate to profile page; tabs.onUpdated will push EXECUTE_CAMPAIGN_SEND
  let tab = await getLinkedInTab();
  if (!tab) {
    tab = await chrome.tabs.create({ url: `https://www.linkedin.com/in/${username}`, active: true });
  } else {
    await chrome.tabs.update(tab.id, { url: `https://www.linkedin.com/in/${username}`, active: true });
  }
}

async function handleCampaignResult(contactId, campaignId, result) {
  await syncToBackend('/campaigns/message-sent', { contactId, campaignId, result }).catch(() => {});
  await chrome.storage.session.remove(['pendingCampaignSend']);

  if (!campaign?.running) return;
  campaign.index++;
  setTimeout(processNext, 4000 + Math.random() * 3000);
}

function personalizeTemplate(template, contact) {
  const raw = contact.name || '';
  // Handle both "Vaishnavi Gawade" and slug "vaishnavi-gawade"
  const firstSegment = raw.split(/[\s-]+/)[0] || 'there';
  const firstName = firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1).toLowerCase();
  const fullName = raw.includes('-')
    ? raw.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : raw;

  return template
    .replace(/\{name\}/g,      firstName)
    .replace(/\{full_name\}/g, fullName)
    .replace(/\{headline\}/g,  contact.headline || '')
    .replace(/\{company\}/g,   contact.company || '');
}

// ── Polling alarm ─────────────────────────────────────────────────────────────
chrome.alarms.create('poll-replies', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'poll-replies') return;
  const tab = await getLinkedInTab();
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'GET_CONVERSATIONS' }, () => {});
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function syncToBackend(path, data) {
  const res = await fetch(`${API_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return res.json();
}

async function getLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
  return tabs[0] ?? null;
}
