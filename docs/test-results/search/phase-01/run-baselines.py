"""Capture existing checks once, with bounded process trees and complete logs."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / "baseline" / "checks"
TESTS = [
    "src/search/__tests__/query.test.ts",
    "src/search/__tests__/SearchScreen.test.tsx",
    "src/chat/__tests__/query.test.ts",
    "src/components/__tests__/MessageText.test.tsx",
    "src/__tests__/a11yPressableSource.test.ts",
    "src/components/__tests__/a11yLabels.test.tsx",
]
CHECKS = {
    "typecheck": (["npm.cmd", "run", "typecheck"], 300),
    "lint": (["npm.cmd", "--workspace", "@dologram/mobile", "run", "lint"], 300),
    "shared": (["npm.cmd", "--workspace", "@dologram/shared", "run", "test"], 300),
    "targeted-mobile": (["npm.cmd", "--workspace", "@dologram/mobile", "run", "test",
                         "--", "--runInBand", "--watch=false", "--cacheDirectory", str(ROOT / ".tmp/search-phase01-jest"), "--runTestsByPath", *TESTS[:4]], 120),
}


def run(item):
    name, (command, timeout) = item
    started = time.monotonic()
    environment = os.environ.copy()
    environment.update({"CI": "1", "EXPO_NO_TELEMETRY": "1", "NO_COLOR": "1"})
    cleanup_status = "not_needed"
    with (OUT / (name + ".log")).open("w", encoding="utf-8") as log:
        process = subprocess.Popen(command, cwd=ROOT, env=environment,
                                   stdout=log, stderr=subprocess.STDOUT)
        try:
            code = process.wait(timeout=timeout)
            status = "passed" if code == 0 else "failed"
        except subprocess.TimeoutExpired:
            cleanup = subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                     stdout=log, stderr=subprocess.STDOUT, check=False)
            cleanup_status = "stopped" if cleanup.returncode == 0 else "requires_process_inventory"
            if cleanup.returncode == 0:
                process.wait(timeout=15)
            code, status = None, "timed_out"
    result = {"name": name, "command": command, "cwd": str(ROOT), "pid": process.pid,
              "status": status, "exit_code": code, "timeout_seconds": timeout,
              "seconds": round(time.monotonic() - started, 2),
              "cleanup": cleanup_status,
              "log": str((OUT / (name + ".log")).relative_to(ROOT))}
    (OUT / (name + ".json")).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result), flush=True)
    return result


if __name__ == "__main__":
    for path in TESTS:
        if not (ROOT / "apps/mobile" / path).is_file():
            raise FileNotFoundError(path)
    OUT.mkdir(parents=True, exist_ok=False)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(run, CHECKS.items()))
    (OUT / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")

