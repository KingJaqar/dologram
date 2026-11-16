/** The approved 5.4s loop. Functions run on Reanimated's UI thread. */
export const CHAT_LOADING_CYCLE_MS = 5400;

function ramp(time: number, start: number): number {
  'worklet';
  const x = Math.max(0, Math.min(1, (time - start) / 250));
  return x * x * (3 - 2 * x);
}

export function quarterPath(size: number, morph = 1): string {
  'worklet';
  const x = 166, y = 272, radius = 22, count = 48;
  let path = '';
  for (let i = 0; i < count; i++) {
    const u = i / count, angle = -Math.PI / 2 + u * 2 * Math.PI;
    const cx = x + radius + radius * Math.cos(angle);
    const cy = y - radius + radius * Math.sin(angle);
    let sx: number, sy: number;
    if (u < 0.25) { sx = x; sy = y - size * u / 0.25; }
    else if (u < 0.75) {
      const a = -Math.PI / 2 + (u - 0.25) / 0.5 * Math.PI / 2;
      sx = x + size * Math.cos(a); sy = y + size * Math.sin(a);
    } else { sx = x + size * (1 - (u - 0.75) / 0.25); sy = y; }
    path += `${i ? 'L' : 'M'}${(cx + (sx - cx) * morph).toFixed(3)},${(cy + (sy - cy) * morph).toFixed(3)}`;
  }
  return path + 'Z';
}

export function loadingQuarter(time: number) {
  'worklet';
  const t = time % CHAT_LOADING_CYCLE_MS;
  return {
    d: quarterPath(t >= 4900 ? 28 : 28 + 112 * ramp(t, 0), t >= 4900 ? ramp(t, 4900) : 1),
    opacity: t < 4900 ? 1 - ramp(t, 850) : 1,
  };
}

export function loadingDot(time: number, index: number) {
  'worklet';
  const t = time % CHAT_LOADING_CYCLE_MS, slide = ramp(t, 4550);
  const elapsed = t - 1900 - index * 100;
  const bounce = elapsed > 0 && elapsed < 1500 ? 9 * Math.sin(Math.PI * elapsed / 500) ** 2 : 0;
  return {
    cx: index === 0 ? 195 - 7 * slide : 195 + 60 * index,
    cy: 208 + (index === 0 ? 42 * slide : 0) - bounce,
    opacity: ramp(t, [450, 1250, 1650][index]) * (1 - ramp(t, [4900, 4150, 3750][index])),
    paper: ramp(t, 850),
  };
}
