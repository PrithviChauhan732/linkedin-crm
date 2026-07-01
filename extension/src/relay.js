window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data?.lcrm) return;
  const { id, payload } = event.data;
  try {
    chrome.runtime.sendMessage(payload, (response) => {
      window.postMessage({ lcrmResponse: true, id, response }, '*');
    });
  } catch {
    // Extension context invalidated (after reload) — relay the null response
    window.postMessage({ lcrmResponse: true, id, response: null }, '*');
  }
});

// Automatically sync token from localStorage to extension storage on load
try {
  const token = window.localStorage.getItem('warmdm_token');
  if (token) {
    chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token });
  }
} catch (e) {
  console.error('[WarmDM] Failed to auto-sync token from localStorage:', e);
}
