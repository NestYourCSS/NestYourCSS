export function registerSW() {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }
}
