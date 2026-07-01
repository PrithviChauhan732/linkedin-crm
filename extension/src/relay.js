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

// Periodically request token from the page context (MAIN world) to sync to extension storage
// This handles client-side navigations, logins, and extension reloads seamlessly.
setInterval(() => {
  try {
    window.postMessage({ lcrmRequestToken: true }, '*');
  } catch {}
}, 2000);
// Run immediately on injection as well
try {
  window.postMessage({ lcrmRequestToken: true }, '*');
} catch {}
