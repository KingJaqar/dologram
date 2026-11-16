import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Avatar } from './Avatar';

test('first two code points, Ana María, UTF-16 fill sum and unknown names match mobile', () => {
  const { container, rerender } = render(<Avatar id="abc" displayName="Ana María Reyes" />);
  expect(container.firstChild).toHaveTextContent('AM');
  expect(container.firstChild).toHaveAttribute('data-fill', String((97 + 98 + 99) % 7));
  rerender(<Avatar id="😀" displayName="  😀na   María Reyes " />);
  expect(container.firstChild).toHaveTextContent('😀M');
  expect(container.firstChild).toHaveAttribute('data-fill', String((0xd83d + 0xde00) % 7));
  rerender(<Avatar id="" displayName=" " />);
  expect(container.firstChild).toHaveTextContent('?');
});

test('special avatars use semantic icons and remain decorative', () => {
  for (const variant of ['saved', 'deleted', 'former'] as const) {
    const { container, unmount } = render(<Avatar id={variant} displayName={variant} variant={variant} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('svg')).not.toBeNull();
    unmount();
  }
});
