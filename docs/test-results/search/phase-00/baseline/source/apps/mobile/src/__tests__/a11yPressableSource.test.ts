import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

type Finding = { file: string; line: number };

function sourceFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(tsx|ts)$/.test(entry.name) && !/\.test\.(tsx|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

function hasAttribute(attributes: ts.JsxAttributes, name: string): boolean {
  return attributes.properties.some(
    (property) => ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function unlabeledPressables(file: string): Finding[] {
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];

  function visit(node: ts.Node): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (
        opening.tagName.getText(tree) === 'Pressable' &&
        !hasAttribute(opening.attributes, 'accessibilityLabel') &&
        !hasAttribute(opening.attributes, 'accessible')
      ) {
        const line = tree.getLineAndCharacterOfPosition(opening.getStart(tree)).line + 1;
        findings.push({ file, line });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(tree);
  return findings;
}

test('mobile Pressable controls declare an accessibilityLabel', () => {
  const roots = [path.resolve(__dirname, '../../app'), path.resolve(__dirname, '../components')];
  const findings = roots.flatMap((root) => sourceFiles(root).flatMap(unlabeledPressables));
  expect(findings).toEqual([]);
});
