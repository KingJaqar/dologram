import { writeFileSync } from 'node:fs';
import { generateTokensCss } from '../packages/shared/src/theme/css.ts';

writeFileSync(new URL('../packages/shared/src/theme/tokens.css', import.meta.url), generateTokensCss());
