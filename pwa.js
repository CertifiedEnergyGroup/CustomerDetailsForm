// Installation is progressive enhancement; the form never depends on it.
const installButton = document.getElementById('install');
let installPrompt;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  installButton.hidden = true;
  try { await prompt.prompt(); await prompt.userChoice; }
  catch (error) { console.warn('[PWA] Installation prompt failed:', error); }
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
});
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {
        scope: './', updateViaCache: 'none'
      });
      await navigator.serviceWorker.ready;
      console.info('[PWA] Offline app assets are ready.', registration.scope);
    } catch (error) {
      console.warn('[PWA] Offline setup failed. Reopen online to retry:', error);
    }
  });
}
