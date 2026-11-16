'use client';

import { useState } from 'react';
import { color, typeTokens } from '@dologram/shared/src/theme/tokens';
import { iconNames, type IconName } from '@dologram/shared/src/theme/icons';
import { Icon } from '../../../components/Icon/Icon';
import { setThemeSetting, useResolvedTheme, useThemeSetting } from '../../../theme/useTheme';
import styles from './tokens.module.css';

export default function TokensPage() {
  const theme = useResolvedTheme();
  const current = useThemeSetting();
  const [error, setError] = useState<string | null>(null);
  return <main className={styles.page}>
    <h1>Design tokens</h1>
    <div role="group" aria-label="Theme">
      {(['system', 'light', 'dark'] as const).map((setting) => <button type="button" key={setting}
        aria-pressed={current === setting} onClick={() => setError(setThemeSetting(setting))}>
        {setting.charAt(0).toUpperCase() + setting.slice(1)}
      </button>)}
    </div>
    {error && <p role="alert">{error}</p>}
    <p role="status">Resolved theme: {theme}</p>
    <section aria-labelledby="colors"><h2 id="colors">Colors</h2><ul className={styles.grid}>
      {Object.entries(color.light).flatMap(([group, value]) => typeof value === 'string'
        ? <li key={group}><span className={styles.swatch} data-color={group} />{group}</li>
        : Object.entries(value).flatMap(([key, nested]) => typeof nested === 'string'
          ? <li key={`${group}-${key}`}><span className={styles.swatch} data-color={`${group}-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`} />{group}.{key}</li>
          : Object.keys(nested).map((leaf) => <li key={`${group}-${key}-${leaf}`}><span className={styles.swatch} data-color={`${group}-${key}-${leaf}`} />{group}.{key}.{leaf}</li>)))}
    </ul></section>
    <section aria-labelledby="type"><h2 id="type">Typography</h2>
      {Object.keys(typeTokens).map((name) => <p key={name} data-type={name}>{name}: DoloGram — The quick brown fox 0123456789</p>)}
      <p><em>Inter italic: The quick brown fox</em></p>
    </section>
    <section aria-labelledby="icons"><h2 id="icons">Semantic icons</h2><ul className={styles.grid}>
      {(Object.keys(iconNames) as IconName[]).map((name) => <li key={name}><Icon name={name} label={name} spin={name === 'ui.loading'} /> {name}</li>)}
    </ul></section>
  </main>;
}
