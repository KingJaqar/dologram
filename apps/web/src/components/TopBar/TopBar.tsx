'use client';

import type { ReactNode } from 'react';
import { strings } from '@dologram/shared/src/strings';
import { IconButton } from '../IconButton/IconButton';
import styles from './TopBar.module.css';

export type TopBarProps = { actions?: ReactNode } & ({ variant: 'chatList' } | { variant: 'screen'; title: string; onBack: () => void });
export function TopBar(props: TopBarProps) {
  return <header className={styles.bar} data-variant={props.variant}>
    {props.variant === 'screen' && <IconButton icon="nav.back" label={strings.common.back} onClick={props.onBack} />}
    <h2>{props.variant === 'chatList' ? 'DoloGram' : props.title}</h2><div className={styles.actions}>{props.actions}</div>
  </header>;
}
