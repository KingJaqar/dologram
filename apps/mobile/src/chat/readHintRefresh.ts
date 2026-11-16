const READ_HINT_BURST_MS = 100;
const READ_HINT_MIN_START_INTERVAL_MS = 250;

export type ReadHintRefresh = {
  invalidate: () => void;
  stop: () => void;
};

/** Coalesces untrusted read hints into one authorized snapshot request plus one follow-up. */
export function createReadHintRefresh(refresh: () => Promise<void>): ReadHintRefresh {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;
  let followUp = false;
  let lastStartedAt = Number.NEGATIVE_INFINITY;

  function schedule(): void {
    if (stopped || timer) return;
    if (running) {
      followUp = true;
      return;
    }
    const sinceLastStart = Date.now() - lastStartedAt;
    const delay = Math.max(READ_HINT_BURST_MS, READ_HINT_MIN_START_INTERVAL_MS - sinceLastStart);
    timer = setTimeout(() => {
      timer = null;
      if (stopped) return;
      lastStartedAt = Date.now();
      const request = refresh();
      running = request;
      void request.catch(() => undefined).finally(() => {
        if (running === request) running = null;
        if (followUp && !stopped) {
          followUp = false;
          schedule();
        }
      });
    }, delay);
  }

  return {
    invalidate: schedule,
    stop() {
      stopped = true;
      followUp = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
