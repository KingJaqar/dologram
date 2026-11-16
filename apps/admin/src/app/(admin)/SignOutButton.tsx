'use client';

import { useActionState } from 'react';
import { Button } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import { signOut } from './actions';

export function SignOutButton() {
  const [message, action, pending] = useActionState(async () => {
    try {
      const result = await signOut();
      return result.message;
    } catch { return 'Could not reach the admin server. Try again.'; }
  }, '');
  return <form action={action}>
    <Button type="submit" variant="secondary" loading={pending}>
      <Icon name="action.signOut" size="sm" />
      Sign out
    </Button>
    {message && <p role="alert">{message}</p>}
  </form>;
}

