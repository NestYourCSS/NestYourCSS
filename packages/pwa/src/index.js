export function registerSW(swPath = '/sw.js', scope) {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    const swScope = scope || (swPath.startsWith('/') ? '/' : undefined);
    navigator.serviceWorker.register(swPath, { scope: swScope });
  }
}
