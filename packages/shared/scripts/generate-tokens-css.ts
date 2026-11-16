import { mkdirSync, writeFileSync } from 'node:fs';
import { generateTokensCss, generateWebTokensCss } from '../src/theme/css.ts';

const web = new URL('../../../apps/web/src/theme/', import.meta.url);
mkdirSync(web, { recursive: true });
writeFileSync(new URL('tokens.css', web), generateWebTokensCss());
// Preserve the existing admin consumer of the shared projection.
writeFileSync(new URL('../src/theme/tokens.css', import.meta.url), generateTokensCss());
