"""Bounded, local calling baseline checks. No install, build upload or DB writes."""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / sys.argv[1]
OUT.mkdir(parents=True, exist_ok=True)
CHECKS = {
    "typecheck": (["npm.cmd", "run", "typecheck"], 180),
    "lint": (["npm.cmd", "run", "lint", "--workspace", "@dologram/mobile"], 180),
    "shared": (["npm.cmd", "run", "test", "--workspace", "@dologram/shared"], 180),
    "mobile": (["npm.cmd", "run", "test", "--workspace", "@dologram/mobile", "--", "--runInBand"], 240),
}


def run(item):
    name, (command, timeout) = item
    started = time.monotonic()
    with (OUT / (name + ".log")).open("w", encoding="utf-8") as log:
        process = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        try:
            code = process.wait(timeout=timeout)
            status = "passed" if code == 0 else "failed"
        except subprocess.TimeoutExpired:
            stopped = subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                     stdout=log, stderr=subprocess.STDOUT, check=False)
            if stopped.returncode != 0:
                log.write(f"\nCleanup requires process-tree verification for PID {process.pid}.\n")
            else:
                process.wait(timeout=15)
            code, status = None, "timed_out"
    result = {"name": name, "command": command, "cwd": str(ROOT),
              "status": status, "exit_code": code,
              "timeout_seconds": timeout, "seconds": round(time.monotonic() - started, 2)}
    print(json.dumps(result), flush=True)
    return result


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(run, CHECKS.items()))
(OUT / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
