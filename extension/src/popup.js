const API_BASE = 'http://localhost:4000/api';

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`);
  return res.json();
}

async function init() {
  loadStats();
  loadTemplates();
  loadUnread();
  checkLinkedInTab();
}

async function checkLinkedInTab() {
  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' });
  const dot = document.getElementById('status-dot');
  const sendBtn = document.getElementById('send-btn');

  if (tabs.length > 0) {
    dot.style.background = '#4ade80';
    sendBtn.disabled = false;
  } else {
    dot.style.background = '#f87171';
    sendBtn.title = 'Open LinkedIn Messaging first';
  }
}

async function loadStats() {
  try {
    const stats = await api('/messages/stats');
    document.getElementById('stat-sent').textContent = stats.sent ?? '-';
    document.getElementById('stat-replied').textContent = stats.replied ?? '-';
    document.getElementById('stat-unread').textContent = stats.unread ?? '-';
  } catch {}
}

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

async function loadUnread() {
  try {
    const { messages } = await api('/messages/unread');
    const list = document.getElementById('unread-list');

    if (!messages || messages.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:16px">No unread messages</div>';
      return;
    }

    list.innerHTML = messages.slice(0, 5).map(m => `
      <div class="unread-item" data-url="${m.profileUrl}">
        <div class="unread-name">${m.name}</div>
        <div class="unread-preview">${m.preview}</div>
      </div>
    `).join('');

    list.querySelectorAll('.unread-item').forEach(item => {
      item.addEventListener('click', () => {
        chrome.tabs.create({ url: item.dataset.url });
        window.close();
      });
    });
  } catch {}
}

// Send message to current LinkedIn conversation
document.getElementById('send-btn').addEventListener('click', async () => {
  const text = document.getElementById('message-text').value.trim();
  if (!text) return;

  const btn = document.getElementById('send-btn');
  const status = document.getElementById('send-status');

  btn.disabled = true;
  btn.textContent = 'Sending...';

  const tabs = await chrome.tabs.query({ url: 'https://www.linkedin.com/messaging/*' });
  if (!tabs[0]) {
    btn.textContent = 'No LinkedIn tab found';
    return;
  }

  chrome.tabs.sendMessage(tabs[0].id, { type: 'SEND_SINGLE_MESSAGE', text }, (res) => {
    btn.disabled = false;
    btn.textContent = 'Send to current conversation';

    if (res?.success) {
      document.getElementById('message-text').value = '';
      status.style.display = 'block';
      setTimeout(() => status.style.display = 'none', 2000);
    } else {
      alert('Failed to send: ' + (res?.error || 'unknown error'));
    }
  });
});

init();
