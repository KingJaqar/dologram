"""Compare this phase's source against the recoverable working-copy snapshot, not HEAD."""
import difflib
import hashlib
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parents[4]
record = pathlib.Path(__file__).parent
baseline = json.loads((record / 'source-baseline.json').read_text(encoding='utf-8-sig'))
with zipfile.ZipFile(record / 'source-baseline.zip') as archive:
    originals = {hashlib.sha256(archive.read(entry)).hexdigest().upper(): archive.read(entry) for entry in archive.infolist()}
changes = []
diffs = []
for entry in baseline:
    path = root / entry['Path']
    before = originals[entry['SHA256']]
    after = path.read_bytes()
    if before == after:
        continue
    changes.append(entry['Path'])
    diffs.extend(difflib.unified_diff(before.decode('utf-8-sig').splitlines(True), after.decode('utf-8-sig').splitlines(True), fromfile='baseline/' + entry['Path'], tofile='current/' + entry['Path']))
(record / 'owned-existing.diff').write_text(''.join(diffs), encoding='utf-8')
(record / 'changed-existing.json').write_text(json.dumps(changes, indent=2), encoding='utf-8')
print('All', len(baseline), 'baseline inputs recovered by SHA-256 from snapshot.')
print('Changed existing inputs:', *changes, sep='\n')
