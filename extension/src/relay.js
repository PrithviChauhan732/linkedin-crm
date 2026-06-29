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
