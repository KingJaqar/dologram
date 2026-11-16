'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { strings } from '@dologram/shared/src/strings';
import { Button } from '../../../components/Button/Button';
import { IconButton } from '../../../components/IconButton/IconButton';
import { TextField } from '../../../components/TextField/TextField';
import { SearchField } from '../../../components/SearchField/SearchField';
import { Avatar, type AvatarSize } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { Dialog } from '../../../components/Dialog/Dialog';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Menu } from '../../../components/Menu/Menu';
import { useToast } from '../../../components/Toast/Toast';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { TopBar } from '../../../components/TopBar/TopBar';
import { useOverlayHistory } from '../../../lib/useOverlayHistory';
import { setThemeSetting, useThemeSetting } from '../../../theme/useTheme';
import styles from './components.module.css';

function MenuExample({ name }: { name: string }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  return <><Button ref={anchor} onClick={() => setOpen(true)} aria-haspopup="menu" aria-expanded={open}>{name}</Button>
    <Menu open={open} onClose={() => setOpen(false)} anchorRef={anchor} label={`${name} actions`} items={[
      { id: 'copy', label: 'Copy', onSelect: () => toast.show({ text: strings.chat.copied }) },
      { id: 'offline', label: 'Archive', disabledReason: strings.common.noConnection, onSelect: () => toast.show({ text: strings.toasts.actions.archiveChat.success }) },
      { id: 'wait', label: 'Loading example', loading, onSelect: () => { setLoading(true); setOpen(true); } },
      { id: 'delete', label: 'Delete', danger: true, onSelect: () => toast.show({ text: strings.toasts.actions.deleteMessage.success }) },
    ]} /></>;
}

export default function ComponentsPage() {
  const theme = useThemeSetting();
  const toast = useToast();
  const dialog = useOverlayHistory('gallery-form');
  const confirm = useOverlayHistory('gallery-confirm');
  const sheet = useOverlayHistory('gallery-sheet');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState(false);
  return <main className={styles.page}>
    <h1>Components</h1>
    <div className={styles.row} role="group" aria-label="Theme">
      {(['system', 'light', 'dark'] as const).map((value) => <Button key={value} variant="secondary" aria-pressed={theme === value} onClick={() => {
        const error = setThemeSetting(value); if (error) toast.show({ text: error });
      }}>{value.charAt(0).toUpperCase() + value.slice(1)}</Button>)}
    </div>
    <section aria-labelledby="buttons"><h2 id="buttons">Buttons</h2><div className={styles.row}>
      {(['primary', 'secondary', 'text', 'danger'] as const).map((variant) => <div className={styles.column} key={variant}>
        <Button variant={variant} onClick={() => toast.show({ text: `${variant} action selected` })}>{variant} action</Button>
        <Button variant={variant} disabled>{variant} disabled</Button>
        <Button variant={variant} loading={loading} loadingLabel="Saving">{variant} loading</Button>
      </div>)}
      <IconButton icon="nav.new" label="Add example" onClick={() => toast.show({ text: 'Example added' })} />
      <IconButton icon="nav.new" label="Add disabled" disabled />
    </div></section>
    <section aria-labelledby="fields"><h2 id="fields">Fields</h2><div className={styles.grid}>
      <TextField label="Display name" helper="1–64 characters" counter="15 / 64" defaultValue="Ana María Reyes" autoComplete="name" />
      <TextField label="Password" type="password" autoComplete="current-password" helper={strings.changePassword.helper} />
      <TextField label="Email error" type="email" defaultValue="invalid" error={strings.signIn.invalidEmail} />
      <TextField label="Disabled field" disabled helper={strings.common.noConnection} />
      <TextField label="Submitting field" loading defaultValue="Read only during submission" />
      <TextField label="Multiline field" multiline helper="Up to six visible lines" />
      <SearchField label="Search chats" placeholder="Search chats" value={search} onValueChange={setSearch} />
    </div></section>
    <section aria-labelledby="avatars"><h2 id="avatars">Avatars and badges</h2><div className={styles.row}>
      {([24, 28, 40, 48, 56, 64, 96] satisfies AvatarSize[]).map((size) => <figure key={size}><Avatar id={`size-${size}`} displayName="Ana María Reyes" size={size} /><figcaption>{size}</figcaption></figure>)}
      {Array.from({ length: 7 }, (_, index) => <Avatar key={index} id={String.fromCharCode(98 + index)} displayName="Ana María Reyes" />)}
      {(['saved', 'deleted', 'former'] as const).map((variant) => <figure key={variant}><Avatar id={variant} displayName={variant} variant={variant} /><figcaption>{variant}</figcaption></figure>)}
      <Badge>12</Badge><Badge variant="muted">Muted 3</Badge>
    </div></section>
    <section aria-labelledby="overlays"><h2 id="overlays">Overlays</h2><div className={styles.row}>
      <Button onClick={dialog.show}>Open form dialog</Button>
      <Button onClick={confirm.show}>Open confirmation</Button>
      <span className={styles.mobileOnly}><Button onClick={sheet.show}>Open bottom sheet</Button></span>
      <MenuExample name="Open menu" />
    </div></section>
    <section aria-labelledby="feedback"><h2 id="feedback">Feedback and loading</h2><div className={styles.row}>
      <Button onClick={() => toast.show({ text: strings.chat.copied })}>Show toast</Button>
      <Button onClick={() => toast.show({ text: strings.common.checkConnection, action: { label: strings.common.retry, onClick: () => toast.show({ text: 'Retry selected' }) } })}>Show action toast</Button>
      <Button onClick={() => setLoading((value) => !value)} aria-pressed={loading}>Toggle loading</Button>
    </div><div className={styles.skeletons}><Skeleton active={loading} /><Skeleton active={loading} shape="circle" /></div>
      <div className={styles.grid}>
        <EmptyState icon="action.archive" title={strings.chatList.noArchived} body={strings.chatList.noArchivedBody} />
        <EmptyState icon="action.newChat" title="Select a chat" body="Choose a chat or start a new one." action={<Button onClick={dialog.show}>New chat example</Button>} />
        <ErrorState title="Couldn't load" body={strings.common.checkConnection} onRetry={() => setRetrying((value) => !value)} loading={retrying} />
        <ErrorState title="Chat unavailable" body={strings.chatInfo.unavailableBody} />
      </div>
    </section>
    <section aria-labelledby="bars"><h2 id="bars">Top bars</h2><TopBar variant="chatList" /><TopBar variant="screen" title="Example screen" onBack={() => toast.show({ text: 'Back selected' })} actions={<IconButton icon="nav.more" label="More example actions" onClick={dialog.show} />} /></section>
    <Link href="/dev/tokens">View design tokens</Link>
    <Dialog overlay={dialog} title="Example form" footer={<><Button variant="secondary" onClick={dialog.close}>Cancel form</Button><Button onClick={() => setActionError(true)}>Submit example</Button></>}>
      <TextField label="Dialog name" autoComplete="off" error={actionError ? strings.signUp.displayNameRequired : undefined} />
      <div className={styles.row}><Button onClick={confirm.show}>Open nested confirmation</Button><MenuExample name="Dialog menu" /><Link href="/dev/tokens">Navigate from dialog</Link><Link href="/dev/components?example=1">Change example query</Link></div>
      {actionError && <ErrorState title="Couldn't submit" body={strings.common.checkConnection} onRetry={() => setActionError(false)} />}
    </Dialog>
    <Dialog overlay={confirm} title="Example confirmation" variant="confirm" footer={<><Button variant="secondary" onClick={confirm.close}>Cancel confirmation</Button><Button variant="danger" onClick={confirm.close}>Confirm example</Button></>}>
      <p>Confirm this gallery action?</p>
    </Dialog>
    <BottomSheet overlay={sheet} title="Example sheet"><div className={styles.column}>
      <Button onClick={confirm.show}>Open sheet confirmation</Button><MenuExample name="Sheet menu" /><Button disabled>{strings.common.noConnection}</Button><Button loading={loading}>Sheet loading</Button><Button variant="danger" onClick={() => { sheet.close(); toast.show({ text: strings.common.checkConnection }); }}>Sheet error example</Button>
    </div></BottomSheet>
  </main>;
}
