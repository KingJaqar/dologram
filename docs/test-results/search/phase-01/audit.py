import difflib, hashlib, json, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[4]
OUT = pathlib.Path(__file__).resolve().parent
changed = ['apps/mobile/src/search/query.ts', 'apps/mobile/src/components/SearchField.tsx',
 'packages/shared/src/strings/index.ts', 'apps/mobile/src/chatList/query.ts',
 'apps/mobile/src/search/__tests__/query.test.ts', 'Plans/DoloGram_Search_Implementation_Plan.md',
 'Plans/context/DoloGram_Search_Context_Index.md']
new = ['apps/mobile/src/search/' + name for name in ['matching.ts','request.ts','people.ts',
 'useMessageSearch.ts','HighlightedText.tsx','SearchResultRow.tsx',
 '__tests__/matching.test.ts','__tests__/people.test.ts','__tests__/useMessageSearch.test.tsx',
 '__tests__/SearchResultRow.test.tsx']]
new += ['apps/mobile/src/components/__tests__/SearchField.test.tsx']
manifest = json.loads((OUT/'baseline/sources.json').read_text())
for item in manifest:
 saved = OUT/'baseline/source'/item['path']
 assert hashlib.sha256(saved.read_bytes()).hexdigest() == item['sha256']
 item['current_sha256'] = hashlib.sha256((ROOT/item['path']).read_bytes()).hexdigest()
 item['changed'] = item['current_sha256'] != item['sha256']
 item['owned'] = item['path'] in changed
 assert not item['changed'] or item['owned'], f'Concurrent change requires review: {item["path"]}'
patch = ''
for name in changed + new:
 before = (OUT/'baseline/source'/name).read_text(encoding='utf-8').splitlines(keepends=True) if name in changed else []
 after = (ROOT/name).read_text(encoding='utf-8').splitlines(keepends=True)
 patch += ''.join(difflib.unified_diff(before, after, fromfile='baseline/'+name, tofile='working/'+name))
(OUT/'owned.diff').write_text(patch,encoding='utf-8')
(OUT/'final-identities.json').write_text(json.dumps({'baseline':manifest,
 'new':[{'path':name,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in new]},indent=2))
packet=json.loads((OUT/'packet.json').read_text())
assert hashlib.sha256((OUT/'context.xml').read_bytes()).hexdigest() == packet['sha256']
scratch=OUT/'restore-rehearsal.md'
scratch.write_bytes((OUT/'baseline/source/Plans/DoloGram_Search_Implementation_Plan.md').read_bytes())
assert hashlib.sha256(scratch.read_bytes()).hexdigest() == next(x['sha256'] for x in manifest if x['path']=='Plans/DoloGram_Search_Implementation_Plan.md')
scratch.unlink()
result={'snapshot_hashes':'passed','restore_rehearsal':'passed','packet_identity':'passed',
 'baseline_files':len(manifest),'changed_files':changed,'new_production_and_test_files':new,
 'unowned_baseline_changes':[]}
(OUT/'validation.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
