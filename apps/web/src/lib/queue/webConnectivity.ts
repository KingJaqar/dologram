/** Browser events are hints; observe again at each request and after a failed request. */
export const webConnectivity = {
  connected: () => navigator.onLine,
  subscribe(listener: () => void) {
    window.addEventListener('online', listener);
    window.addEventListener('offline', listener);
    return () => {
      window.removeEventListener('online', listener);
      window.removeEventListener('offline', listener);
    };
  },
};
