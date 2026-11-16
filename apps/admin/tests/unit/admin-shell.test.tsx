import type { HTMLAttributes, ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sidebar, isCurrentPath } from '../../src/components/Sidebar/Sidebar';
import { AdminHeader } from '../../src/components/AdminHeader/AdminHeader';

let pathname = '/';

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & HTMLAttributes<HTMLAnchorElement>) =>
    <a href={href} {...rest}>{children}</a>,
}));
vi.mock('server-only', () => ({}));

afterEach(() => vi.unstubAllEnvs());

describe('Sidebar', () => {
  it('renders the five admin destinations in 12.6 order with exact accessible names', () => {
    pathname = '/';
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    expect(within(nav).getAllByRole('link').map((link) => link.getAttribute('href')))
      .toEqual(['/', '/accounts', '/maintenance', '/audit', '/settings-check']);
    for (const name of ['Overview', 'Accounts', 'Maintenance', 'Audit log', 'Settings check']) {
      expect(within(nav).getByRole('link', { name })).toBeTruthy();
    }
    expect(within(nav).getByText('DoloGram Admin')).toBeTruthy();
  });

  it('marks exactly one current destination, including nested account paths', () => {
    pathname = '/accounts/new';
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    const current = within(nav).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.getAttribute('href'))).toEqual(['/accounts']);
    expect([isCurrentPath('/', '/'), isCurrentPath('/accounts', '/'), isCurrentPath('/accounts', '/accounts'),
      isCurrentPath('/accounts/import', '/accounts'), isCurrentPath('/audit', '/accounts')])
      .toEqual([true, false, true, true, false]);
  });

  it('keeps the rail tooltip out of the accessible name', () => {
    pathname = '/audit';
    render(<Sidebar />);
    const link = screen.getByRole('link', { name: 'Audit log' });
    const tooltip = link.querySelector('span[aria-hidden="true"]');
    expect(tooltip?.textContent).toBe('Audit log');
    expect(link.textContent).toBe('Audit logAudit log');
  });
});

describe('AdminHeader', () => {
  it('labels the configured project and hosts the session action', () => {
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    render(<AdminHeader action={<button type="button">Sign out</button>} />);
    const header = screen.getByRole('banner');
    expect(within(header).getByText('abcdefghijklmnopqrst')).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('shows a safe fallback when the project reference is unavailable', () => {
    vi.stubEnv('SUPABASE_PROJECT_REF', '');
    render(<AdminHeader action={null} />);
    expect(screen.getByText('Project not configured')).toBeTruthy();
  });
});
