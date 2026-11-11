import type { Href, ImperativeRouter } from 'expo-router';

/** Direct links and restored screens may have no previous route to return to. */
export function goBackOrReplace(
  router: Pick<ImperativeRouter, 'canGoBack' | 'back' | 'replace'>,
  fallback: Href = '/(main)/(tabs)',
): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
