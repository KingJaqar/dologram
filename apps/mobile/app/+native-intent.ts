export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'dologram://app');
    if (url.hostname === 'expo-sharing' || url.hostname === 'share') return '/handle-share';
    if (url.hostname === 'memo-reminder') return `/memo-reminder${url.search}`;
    return path;
  } catch {
    return '/handle-share';
  }
}
