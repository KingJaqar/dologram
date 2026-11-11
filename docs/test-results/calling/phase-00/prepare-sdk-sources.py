"""Recreate the public, integrity-checked Phase 0 source cache; installs nothing."""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / ".tmp/calling-phase00/vendor"
METADATA = Path(__file__).with_name("package-candidates.json")

for package in json.loads(METADATA.read_text(encoding="utf-8")):
    url = package["dist"]["tarball"]
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "registry.npmjs.org":
        raise ValueError("Only fixed public npm registry sources are permitted")
    with urllib.request.urlopen(url, timeout=30) as response:
        raw = response.read(20 * 1024 * 1024 + 1)
    if len(raw) > 20 * 1024 * 1024:
        raise ValueError("Unexpected archive size")
    integrity = "sha512-" + base64.b64encode(hashlib.sha512(raw).digest()).decode()
    if integrity != package["dist"]["integrity"]:
        raise ValueError("Package integrity mismatch: " + package["name"])
    name = package["name"].replace("@", "").replace("/", "--")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / (name + ".tgz")).write_bytes(raw)
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
        for member in archive.getmembers():
            selected = (
                member.name.startswith(("package/src/", "package/plugin/", "package/android/src/"))
                or member.name in ("package/package.json", "package/README.md",
                                   "package/android/build.gradle", "package/android/gradle.properties",
                                   "package/expo-module.config.json")
                or name == "config-plugins--react-native-webrtc"
            )
            if not member.isfile() or not selected:
                continue
            target = OUT / name / Path(member.name).relative_to("package")
            if not target.resolve().is_relative_to((OUT / name).resolve()):
                raise ValueError("Unsafe archive path")
            content = archive.extractfile(member)
            if content is None:
                raise ValueError("Missing archive member")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content.read())
    print(package["name"], package["version"], "integrity verified")
