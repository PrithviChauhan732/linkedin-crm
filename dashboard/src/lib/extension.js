/**
 * Send a message to the LinkedIn CRM extension from the dashboard.
 * Uses the relay.js content script injected by the extension on localhost:3000,
 * so no extension ID is needed here.
 */
export function sendToExtension(message, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);

    const handler = (event) => {
      if (event.data?.lcrmResponse && event.data.id === id) {
        window.removeEventListener('message', handler);
        clearTimeout(timer);
        resolve(event.data.response ?? null);
      }
    };
    window.addEventListener('message', handler);

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, timeoutMs);

    window.postMessage({ lcrm: true, id, payload: message }, '*');
  });
}

export function extensionAvailable() {
  return typeof window !== 'undefined' && typeof window.postMessage === 'function';
}
