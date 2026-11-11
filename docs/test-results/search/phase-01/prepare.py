import hashlib, json, pathlib, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = pathlib.Path(__file__).resolve().parent
paths = [
 'apps/mobile/AGENTS.md', 'apps/mobile/package.json', 'package.json',
 'apps/mobile/src/search/query.ts', 'apps/mobile/src/search/__tests__/query.test.ts',
 'apps/mobile/src/components/SearchField.tsx', 'apps/mobile/src/search/__tests__/SearchScreen.test.tsx',
 'apps/mobile/src/chats/infoQuery.ts', 'packages/shared/src/chats/contacts.ts',
 'packages/shared/src/chats/direct.ts', 'packages/shared/src/queue/types.ts',
 'apps/mobile/src/queue/events.ts', 'apps/mobile/src/sync/cacheEvents.ts',
 'apps/mobile/src/chatList/preferences.ts', 'apps/mobile/src/chats/preferences.ts',
]
snapshot = paths + ['Plans/DoloGram_Search_Implementation_Plan.md',
 'Plans/context/DoloGram_Search_Context_Index.md', 'packages/shared/src/strings/index.ts',
 'apps/mobile/src/queue/db.ts', 'apps/mobile/src/chat/query.ts',
 'apps/mobile/src/chatList/query.ts', 'apps/mobile/src/chatList/useChatList.ts',
 'apps/mobile/src/components/Avatar.tsx', 'apps/mobile/src/theme/ThemeProvider.tsx',
 'apps/mobile/app/search.tsx', 'apps/mobile/app/chat/[chatId]/search.tsx',
 'apps/mobile/app/forward.tsx', 'package-lock.json']
manifest = []
for name in snapshot:
 source = ROOT / name
 dest = OUT / 'baseline/source' / name
 dest.parent.mkdir(parents=True, exist_ok=True)
 shutil.copyfile(source, dest)
 digest = hashlib.sha256(source.read_bytes()).hexdigest()
 assert hashlib.sha256(dest.read_bytes()).hexdigest() == digest
 manifest.append({'path': name, 'sha256': digest, 'packet': name in paths})
(OUT / 'baseline/sources.json').write_text(json.dumps(manifest, indent=2))
for name, args in [('status', ['status', '--short', '--untracked-files=all']),
                   ('tracked', ['diff', '--binary']), ('staged', ['diff', '--cached', '--binary'])]:
 (OUT / 'baseline' / (name + '.txt')).write_bytes(subprocess.check_output(['git', *args], cwd=ROOT))
with (OUT / 'repomix.log').open('w', encoding='utf-8') as log:
 result = subprocess.run(['repomix.cmd', '--include', ','.join(paths), '--style', 'xml',
  '--parsable-style', '--no-git-sort-by-changes', '-o', str(OUT / 'context.xml')], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
 assert result.returncode == 0
import xml.etree.ElementTree as ET
tree = ET.parse(OUT / 'context.xml')
entries = tree.findall('.//file')
assert set(e.attrib['path'] for e in entries) == set(paths)
chunks, current = [], ''
for entry in entries:
 text = 'SOURCE ' + entry.attrib['path'] + '\n' + (entry.text or '') + '\n'
 for line in text.splitlines(keepends=True):
  if len(current) + len(line) > 11500 or current.count('\n') >= 195:
   chunks.append(current); current = ''
  current += line
if current: chunks.append(current)
for i, chunk in enumerate(chunks, 1):
 (OUT / f'packet-read-{i}.txt').write_text(chunk, encoding='utf-8')
(OUT / 'packet.json').write_text(json.dumps({'version':'1.18.1', 'selectors':paths,
 'actual':[e.attrib['path'] for e in entries], 'compression':False, 'security':'enabled',
 'sha256':hashlib.sha256((OUT/'context.xml').read_bytes()).hexdigest(),
 'chunks':[{'file':f'packet-read-{i}.txt','characters':len(c),'lines':c.count('\n')} for i,c in enumerate(chunks,1)]},indent=2))
print(f'Snapshotted {len(snapshot)} files; packet {len(entries)} entries; {len(chunks)} bounded chunks.')
