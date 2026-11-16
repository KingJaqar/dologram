import { CHAT_LOADING_CYCLE_MS, loadingDot, loadingQuarter } from '../loadingLogoTimeline';

test('each dot makes exactly three full bounces and rests before the reverse exit', () => {
  for (let index = 0; index < 3; index++) {
    const positions: number[] = [];
    for (let time = 1850; time <= 3700; time += 10) positions.push(loadingDot(time, index).cy);
    const peaks = positions.filter((y, i) => i > 0 && i < positions.length - 1 && y < positions[i - 1] && y < positions[i + 1]);
    expect(peaks).toHaveLength(3);
    expect(Math.min(...positions)).toBeCloseTo(199);
    expect(loadingDot(3700, index)).toMatchObject({ cy: 208, opacity: 1 });
  }
  expect(loadingDot(4000, 2).opacity).toBe(0);
  expect(loadingDot(4000, 1).opacity).toBe(1);
  expect(loadingDot(4400, 1).opacity).toBe(0);
  expect(loadingDot(4400, 0).opacity).toBe(1);
});

test('the loop joins at the small quarter-circle with no visible dots or outer fade', () => {
  expect(loadingQuarter(CHAT_LOADING_CYCLE_MS - 1)).toEqual(loadingQuarter(0));
  expect(loadingQuarter(CHAT_LOADING_CYCLE_MS)).toEqual(loadingQuarter(0));
  for (let index = 0; index < 3; index++) {
    expect(loadingDot(CHAT_LOADING_CYCLE_MS - 1, index).opacity).toBe(0);
    expect(loadingDot(0, index).opacity).toBe(0);
  }
  expect(loadingQuarter(250).d).not.toBe(loadingQuarter(0).d);
  expect(loadingQuarter(1100).opacity).toBe(0);
});
