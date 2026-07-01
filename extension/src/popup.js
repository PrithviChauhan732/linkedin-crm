const API_BASE = 'http://localhost:4000/api';

// ── API helpers ───────────────────────────────────────────────────────────────
async function getToken() {
  const { token } = await chrome.storage.local.get('token');
  return token || null;
}

async function api(path, opts = {}) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers, ...opts });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  return api(path, { method: 'POST', body: JSON.stringify(body) });
}

// ── State ─────────────────────────────────────────────────────────────────────
let currentContext = null; // { type: 'profile'|'company', name, sub, data }
let groups = [];

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  setupTabs();
  await loadGroups();
  loadStats();
  loadTemplates();
  loadUnread();
  detectCurrentPageContext();
  checkLinkedInTab();
}

// ── Tab switching ──────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ── Detect current LinkedIn page context ──────────────────────────────────────
async function detectCurrentPageContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const url  = tab.url;
  const path = new URL(url).pathname;

  // Company page
  const companyMatch = path.match(/^\/company\/([^/?#]+)/);
  if (companyMatch) {
    // Ask content script for scraped data
    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' }, (res) => {
      const name = res?.name || companyMatch[1].replace(/-/g, ' ');
      showContextBar('company', name, res?.sub || '', { linkedinUrl: url, name, ...res });
    });
    return;
  }

  // Profile page
  const profileMatch = path.match(/^\/in\/([^/?#]+)/);
  if (profileMatch) {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' }, (res) => {
      const name = res?.name || profileMatch[1].replace(/-/g, ' ');
      showContextBar('profile', name, res?.sub || '', { profileUrl: url, name, username: profileMatch[1], ...res });
    });
  }
}

function showContextBar(type, name, sub, data) {
  currentContext = { type, name, sub, data };
  const bar = document.getElementById('context-bar');
  document.getElementById('ctx-type').textContent = type === 'company' ? '🏢 Company Page' : '👤 Profile Page';
  document.getElementById('ctx-name').value = name;
  document.getElementById('ctx-sub').textContent  = sub || '';
  document.getElementById('ctx-sub').style.display = sub ? 'block' : 'none';
  
  const statusEl = document.getElementById('ctx-conn-status');
  const connectBtn = document.getElementById('ctx-connect-btn');
  if (type === 'profile' && data.connectionStatus) {
    statusEl.style.display = 'inline-block';
    statusEl.className = 'status-badge ' + data.connectionStatus;
    statusEl.textContent = data.connectionStatus.replace('_', ' ');
    if (data.connectionStatus === 'connected') {
      connectBtn.style.display = 'none';
    } else {
      connectBtn.style.display = 'block';
    }
  } else {
    statusEl.style.display = 'none';
    connectBtn.style.display = 'none';
  }

  bar.classList.add('visible');
  populateGroupSelect('ctx-group-select', type === 'profile' ? data.company : '');
}

function populateGroupSelect(selectId, autoSelectName = '') {
  const sel = document.getElementById(selectId);
  // Remove all except first option
  while (sel.options.length > 1) sel.remove(1);
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g._id;
    opt.textContent = g.name;
    if (autoSelectName && g.name.toLowerCase() === autoSelectName.toLowerCase()) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
}

// Update Connected Status
document.getElementById('ctx-connect-btn').addEventListener('click', async () => {
  if (!currentContext || currentContext.type !== 'profile') return;
  const statusEl = document.getElementById('context-save-status');
  const btn = document.getElementById('ctx-connect-btn');
  
  btn.disabled = true;
  btn.textContent = 'Updating...';
  
  try {
    const updatedData = { ...currentContext.data, name: document.getElementById('ctx-name').value, status: 'connected' };
    const groupId  = document.getElementById('ctx-group-select').value || null;
    await apiPost('/contacts/upsert', { ...updatedData, groups: groupId ? [groupId] : [] });
    
    document.getElementById('ctx-conn-status').className = 'status-badge connected';
    document.getElementById('ctx-conn-status').textContent = 'connected';
    btn.style.display = 'none';
    statusEl.textContent = '✓ Updated CRM to Connected!';
    setTimeout(() => { statusEl.textContent = ''; }, 2500);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Set Connected';
    statusEl.textContent = 'Failed to update.';
  }
});

// Save context to CRM
document.getElementById('ctx-save-btn').addEventListener('click', async () => {
  if (!currentContext) return;
  const groupId  = document.getElementById('ctx-group-select').value || null;
  const statusEl = document.getElementById('context-save-status');
  const btn      = document.getElementById('ctx-save-btn');
  const customName = document.getElementById('ctx-name').value;

  btn.disabled = true;
  btn.textContent = '...';

  try {
    if (currentContext.type === 'company') {
      await apiPost('/companies/upsert', { ...currentContext.data, name: customName, groupId });
    } else {
      const connStatus = currentContext.data.connectionStatus || 'new';
      await apiPost('/contacts/upsert', { ...currentContext.data, name: customName, status: connStatus, groups: groupId ? [groupId] : [] });
    }
    statusEl.textContent = '✓ Saved to CRM!';
    btn.textContent = '✓';
    btn.classList.add('saved');
    setTimeout(() => {
      statusEl.textContent = '';
      btn.textContent = 'Save';
      btn.classList.remove('saved');
      btn.disabled = false;
    }, 2500);
  } catch (e) {
    statusEl.textContent = 'Not logged in — open dashboard first.';
    btn.textContent = 'Save';
    btn.disabled = false;
  }
});

// ── Groups Panel ──────────────────────────────────────────────────────────────
async function loadGroups() {
  try {
    const data = await api('/groups');
    groups = data.groups || [];
    renderGroupsList();
  } catch {
    groups = [];
  }
}

function renderGroupsList() {
  const list = document.getElementById('groups-list');
  if (!groups.length) {
    list.innerHTML = '<div style="font-size:11px;color:#475569;text-align:center;padding:16px">No groups yet. Create one above.</div>';
    return;
  }

  list.innerHTML = groups.map(g => `
    <div class="group-item">
      <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
        <div class="group-dot" style="background:${g.color || '#2563eb'}"></div>
        <div style="min-width:0;">
          <div class="group-name">${escHtml(g.name)}</div>
          <div class="group-count">${g.contactCount ?? 0} contacts</div>
        </div>
      </div>
      <a class="group-open" href="http://localhost:3000/groups/${g._id}" target="_blank">Open →</a>
    </div>
  `).join('');
}

// New group form toggle
document.getElementById('new-group-toggle').addEventListener('click', () => {
  const form = document.getElementById('new-group-form');
  form.classList.toggle('open');
  if (form.classList.contains('open')) {
    document.getElementById('ng-name').focus();
    document.getElementById('new-group-toggle').textContent = '✕';
  } else {
    document.getElementById('new-group-toggle').textContent = '+ New';
  }
});

document.getElementById('ng-cancel-btn').addEventListener('click', () => {
  document.getElementById('new-group-form').classList.remove('open');
  document.getElementById('new-group-toggle').textContent = '+ New';
});

document.getElementById('ng-create-btn').addEventListener('click', async () => {
  const name  = document.getElementById('ng-name').value.trim();
  const color = document.getElementById('ng-color').value;
  const desc  = document.getElementById('ng-desc').value.trim();
  const status = document.getElementById('ng-status');

  if (!name) { status.textContent = 'Name is required.'; return; }

  const btn = document.getElementById('ng-create-btn');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    await apiPost('/groups', { name, color, description: desc });
    status.textContent = '✓ Group created!';
    document.getElementById('ng-name').value = '';
    document.getElementById('ng-desc').value = '';
    document.getElementById('ng-color').value = '#2563eb';
    await loadGroups();
    populateGroupSelect('ctx-group-select');
    setTimeout(() => {
      status.textContent = '';
      document.getElementById('new-group-form').classList.remove('open');
      document.getElementById('new-group-toggle').textContent = '+ New';
    }, 1500);
  } catch {
    status.textContent = 'Not logged in — open dashboard.';
  }
  btn.disabled = false;
  btn.textContent = 'Create Group';
});

// ── LinkedIn tab detection ────────────────────────────────────────────────────
async function checkLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' });
  const dot  = document.getElementById('status-dot');
  const sendBtn = document.getElementById('send-btn');
  if (tabs.length > 0) {
    dot.classList.remove('offline');
    sendBtn.disabled = false;
  } else {
    dot.classList.add('offline');
    sendBtn.title = 'Open LinkedIn Messaging first';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const stats = await api('/messages/stats');
    document.getElementById('stat-sent').textContent    = stats.sent    ?? '-';
    document.getElementById('stat-replied').textContent = stats.replied ?? '-';
    document.getElementById('stat-unread').textContent  = stats.unread  ?? '-';
  } catch {}
}

// ── Templates ─────────────────────────────────────────────────────────────────
async function loadTemplates() {
  try {
    const { templates } = await api('/templates');
    const sel = document.getElementById('template-select');
    templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.body;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      if (sel.value) document.getElementById('message-text').value = sel.value;
    });
  } catch {}
}

// ── Unread ────────────────────────────────────────────────────────────────────
async function loadUnread() {
  try {
    const { messages } = await api('/messages/unread');
    const list = document.getElementById('unread-list');
    if (!messages?.length) {
      list.innerHTML = '<div style="font-size:11px;color:#475569;text-align:center;padding:16px">No unread messages</div>';
      return;
    }
    list.innerHTML = messages.slice(0, 6).map(m => `
      <div class="unread-item" data-url="${m.profileUrl || ''}">
        <div class="unread-name">${escHtml(m.name)}</div>
        <div class="unread-preview">${escHtml(m.preview || '')}</div>
      </div>
    `).join('');
    list.querySelectorAll('.unread-item').forEach(item => {
      if (item.dataset.url) {
        item.addEventListener('click', () => { chrome.tabs.create({ url: item.dataset.url }); window.close(); });
      }
    });
  } catch {}
}

document.getElementById('sync-conn-btn').addEventListener('click', () => {
  const btn = document.getElementById('sync-conn-btn');
  const status = document.getElementById('sync-ml-status');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  chrome.runtime.sendMessage({ type: 'TRIGGER_CONNECTIONS_SYNC' }, res => {
    if (res?.ok) {
      status.style.display = 'block';
      status.style.color = '#34d399';
      status.textContent = '✓ Syncing in background...';
      setTimeout(() => {
        status.style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Sync Connections';
      }, 3000);
    } else {
      btn.disabled = false;
      btn.textContent = 'Sync Connections';
    }
  });
});

document.getElementById('sync-ml-btn').addEventListener('click', async () => {
  const btn = document.getElementById('sync-ml-btn');
  const status = document.getElementById('sync-ml-status');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  
  try {
    const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/*' });
    if (!tabs[0]) {
      status.style.display = 'block';
      status.style.color = '#f87171';
      status.textContent = 'Open LinkedIn first.';
      setTimeout(() => status.style.display = 'none', 3000);
      btn.disabled = false;
      btn.textContent = 'Sync Chats & ML';
      return;
    }
    
    // Trigger GET_CONVERSATIONS in content script, which routes to backend automatically
    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CONVERSATIONS' }, () => {});
    
    status.style.display = 'block';
    status.style.color = '#34d399';
    status.textContent = '✓ Sync triggered!';
    setTimeout(() => {
      status.style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Sync Chats & ML';
    }, 2000);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Sync Chats & ML';
  }
});

// ── Send message ──────────────────────────────────────────────────────────────
document.getElementById('send-btn').addEventListener('click', async () => {
  const text = document.getElementById('message-text').value.trim();
  if (!text) return;
  const btn = document.getElementById('send-btn');
  const status = document.getElementById('send-status');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' });
  if (!tabs[0]) { btn.textContent = 'No LinkedIn tab'; return; }
  chrome.tabs.sendMessage(tabs[0].id, { type: 'SEND_SINGLE_MESSAGE', text }, res => {
    btn.disabled = false;
    btn.textContent = 'Send to current conversation';
    if (res?.success) {
      document.getElementById('message-text').value = '';
      status.style.display = 'block';
      setTimeout(() => status.style.display = 'none', 2000);
    } else {
      alert('Failed: ' + (res?.error || 'unknown'));
    }
  });
});

// ── Utils ─────────────────────────────────────────────────────────────────────
function escHtml(s = '') {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
