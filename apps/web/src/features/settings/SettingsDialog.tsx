'use client';

import { useCallback, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { strings } from '@dologram/shared/src/strings';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Dialog } from '../../components/Dialog/Dialog';
import { Icon } from '../../components/Icon/Icon';
import { useOverlayHistory } from '../../lib/useOverlayHistory';
import { useSession } from '../../lib/session/SessionProvider';
import { signOutAndWipe } from '../../lib/session/signOut';
import { useStore } from '../../lib/store/StoreProvider';
import { useStoreQuery } from '../../lib/store/useStoreQuery';
import { setThemeSetting, useThemeSetting, type ThemeSetting } from '../../theme/useTheme';
import styles from './SettingsDialog.module.css';

const version = process.env.NEXT_PUBLIC_DG_VERSION ?? '0.0.0';
const build = process.env.NEXT_PUBLIC_DG_BUILD ?? 'local';
const themes: { value: ThemeSetting; label: string; icon: 'theme.system' | 'theme.light' | 'theme.dark' }[] = [
  { value: 'system', label: strings.settings.themeSystem, icon: 'theme.system' },
  { value: 'light', label: strings.settings.themeLight, icon: 'theme.light' },
  { value: 'dark', label: strings.settings.themeDark, icon: 'theme.dark' },
];

/** WEB-14 / 12.5 Settings template: profile, appearance, account and About (D-19, D-83, D-109 (5)). */
export function SettingsDialog() {
  const { profile, session, online, controller } = useSession();
  const store = useStore();
  const router = useRouter();
  const theme = useThemeSetting();
  const confirm = useOverlayHistory('settings-sign-out');
  const [themeError, setThemeError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const accountId = useId();
  const aboutId = useId();
  const offlineId = useId();
  const owner = session?.user.id ?? '';
  const read = useCallback(async () => ({
    unsent: await store.countUnsent(),
    profile: (await store.list('profiles')).find((row) => row.user_id === owner) ?? null,
  }), [store, owner]);
  const query = useStoreQuery(store, read);
  const cached = query.data?.profile ?? null;
  const name = cached?.display_name ?? profile?.display_name ?? strings.settings.profileFallback;
  const username = cached?.username ?? profile?.username ?? null;
  const unsent = query.data?.unsent ?? 0;

  return <>
    <div className={styles.content}>
      <div className={styles.profile}>
        <Avatar id={cached?.user_id ?? owner} displayName={name} size={64} />
        <div className={styles.identity}>
          <p className={styles.name}>{name}</p>
          {username && <p className={styles.username}>@{username}</p>}
        </div>
      </div>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{strings.settings.appearance}</legend>
        <div className={styles.options}>
          {themes.map((option) => <label key={option.value} className={styles.option}>
            <input className={styles.input} type="radio" name="dg-theme" value={option.value}
              checked={theme === option.value} onChange={() => setThemeError(setThemeSetting(option.value))} />
            <Icon name={option.icon} size="md" />
            <span>{option.label}</span>
          </label>)}
        </div>
        {themeError && <p role="alert" className={styles.error}>{themeError}</p>}
      </fieldset>
      <section className={styles.section} aria-labelledby={accountId}>
        <h3 id={accountId} className={styles.legend}>{strings.settings.account}</h3>
        <button type="button" className={styles.row} onClick={() => router.replace('/change-password?from=settings')}
          disabled={!online} aria-describedby={online ? undefined : offlineId}>
          <Icon name="action.changePassword" size="md" />
          <span className={styles.rowLabel}>{strings.settings.changePassword}</span>
          <Icon name="nav.forward" size="sm" />
        </button>
        {!online && <p id={offlineId} className={styles.hint}>{strings.common.noConnection}</p>}
        <button type="button" className={`${styles.row} ${styles.danger}`} onClick={confirm.show}>
          <Icon name="action.signOut" size="md" />
          <span className={styles.rowLabel}>{strings.settings.signOut}</span>
        </button>
      </section>
      <section className={styles.section} aria-labelledby={aboutId}>
        <h3 id={aboutId} className={styles.legend}>{strings.settings.about}</h3>
        <p className={styles.about}>{strings.settings.aboutLine(version, build)}</p>
      </section>
      {query.status === 'loading' && <p role="status" className={styles.hint}>{strings.settings.checkingUnsent}</p>}
      {query.error && <div className={styles.section}>
        <p role="alert" className={styles.error}>{query.error}</p>
        <Button variant="text" onClick={query.retry}>{strings.common.retry}</Button>
      </div>}
    </div>
    <Dialog overlay={confirm} title={strings.settings.signOutTitle} variant="confirm" footer={<>
      <Button variant="secondary" onClick={confirm.close}>{strings.common.cancel}</Button>
      <Button variant="danger" loading={signingOut} disabled={query.status !== 'ready'}
        onClick={() => { setSigningOut(true); void signOutAndWipe(controller).finally(() => setSigningOut(false)); }}>
        {strings.settings.signOut}
      </Button>
    </>}>
      <p>{unsent > 0 ? strings.settings.signOutWarning(unsent) : strings.settings.signOutConfirmBody}</p>
    </Dialog>
  </>;
}
