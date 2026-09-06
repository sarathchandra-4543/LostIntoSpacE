"""Run every Python test suite in the repository.

There is no single pytest invocation that covers this repo, and that is by
design rather than an oversight. `pyproject.toml` at the root configures only
the P4-owned trees (`data/`, `search/`, `ai/`, `packages/contracts/`) and says
so explicitly; `apps/api/pyproject.toml` carries its own
`[tool.pytest.ini_options]`, which makes `apps/api` a separate pytest rootdir
with its own `testpaths`. Broadening the root `testpaths` to cover everything
would quietly overrule both ownership boundaries and change which config each
tree is collected under.

So the suites stay separate and this script runs all four in turn:

    python scripts/dev/test_all.py

Any argument is forwarded to every pytest run, e.g. `-x` or `-k pattern`.
Exits non-zero if any suite fails.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

#: (label, working directory, pytest target). An empty target means "use the
#: testpaths this directory's own config already declares".
SUITES = [
    ("data / search / ai", ROOT, ""),
    ("apps/api", ROOT / "apps" / "api", ""),
    ("simulation", ROOT, "simulation/tests"),
    ("evaluation", ROOT, "evaluation/tests"),
]


def main() -> int:
    extra = sys.argv[1:]
    failures = []

    for label, cwd, target in SUITES:
        command = [sys.executable, "-m", "pytest"]
        if target:
            command.append(target)
        command.extend(extra)

        print("\n=== {0} ===".format(label), flush=True)
        completed = subprocess.run(command, cwd=str(cwd))
        if completed.returncode != 0:
            failures.append(label)

    print("\n" + "=" * 60)
    if failures:
        print("FAILED: " + ", ".join(failures))
        return 1
    print("All {0} suites passed.".format(len(SUITES)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
