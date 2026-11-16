import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';

test('the entire shared export graph contains no native or Node runtime imports', () => {
  const root = resolve(import.meta.dirname, '../../../packages/shared/src');
  const visited = new Set();
  const external = new Set();
  const inspect = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
      const specifier = statement.moduleSpecifier;
      if (!ts.isStringLiteral(specifier)) throw new Error('Unexpected shared module specifier');
      const name = specifier.text;
      if (!name.startsWith('.')) { external.add(name); continue; }
      const target = resolve(dirname(file), name);
      const resolved = [target + '.ts', resolve(target, 'index.ts')].find(existsSync);
      if (!resolved) throw new Error(`Unresolved shared module: ${name}`);
      inspect(resolved);
    }
  };
  inspect(resolve(root, 'index.ts'));
  expect([...external]).toEqual(['@supabase/supabase-js']);
  expect(visited.has(resolve(root, 'memos/store.ts'))).toBe(true);
  expect(visited.has(resolve(root, 'calls/repository.ts'))).toBe(true);
});
