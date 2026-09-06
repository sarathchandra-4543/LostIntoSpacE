# Installing LostIntoSpacE

Pick your operating system, run the block, and you will have the prototype
running at <http://localhost:3000>.

Every command here has a reason for being different between systems, and the
reasons are stated rather than assumed. The most common way a setup guide wastes
someone's evening is by giving one incantation and leaving them to guess why it
does not work on their machine.

| | [Windows](#windows) | [macOS](#macos) | [Debian / Ubuntu](#debian-ubuntu-mint-pop_os) | [Fedora / RHEL](#fedora-rhel-centos-stream-rocky-alma) | [Arch](#arch-manjaro-endeavouros) | [openSUSE](#opensuse) | [Alpine](#alpine) | [Docker](#docker-any-os) |
|---|---|---|---|---|---|---|---|---|

**What you need on any system:** Python 3.11 or newer, Node.js 18 or newer, Git.
PostgreSQL 13+ is optional — see [Do I need a database?](#do-i-need-a-database)

---

## The one difference that catches everyone

The Python executable is called something different depending on where you are.

| System | Interpreter | Virtualenv activation |
|---|---|---|
| Windows (PowerShell) | `python` | `.venv\Scripts\Activate.ps1` |
| Windows (Git Bash) | `python` | `source .venv/Scripts/activate` |
| macOS (Homebrew) | `python3` | `source .venv/bin/activate` |
| Debian, Ubuntu, Mint | `python3` | `source .venv/bin/activate` |
| Fedora, RHEL, Rocky | `python3` | `source .venv/bin/activate` |
| Arch, Manjaro | `python` | `source .venv/bin/activate` |
| openSUSE | `python3` | `source .venv/bin/activate` |
| Alpine | `python3` | `source .venv/bin/activate` |

On most Linux distributions `python` either does not exist or still points at
Python 2, which is why `python3` is spelled out. Arch is the exception: it
dropped Python 2 years ago and `python` *is* Python 3 there. On Windows the
official installer and the Microsoft Store both provide `python`, and `python3`
is an alias that opens the Store if Python is missing — which is why a guide
that says `python3` sends Windows users to a shopping page.

**Inside an activated virtualenv this stops mattering.** `python` and `pip`
both point into `.venv`, so every command after activation is identical on every
system. That is the whole point of activating it.

---

## Windows

### Prerequisites

Using [winget](https://learn.microsoft.com/windows/package-manager/), which ships
with Windows 10 1809 and later:

```powershell
winget install --id Python.Python.3.12 -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
winget install --id PostgreSQL.PostgreSQL.16 -e   # optional
```

Or with [Chocolatey](https://chocolatey.org/):

```powershell
choco install python312 nodejs-lts git postgresql16
```

Close and reopen your terminal afterwards so `PATH` is picked up.

> **Windows 8.1 or older, or no winget:** download the installers from
> [python.org](https://www.python.org/downloads/windows/) and
> [nodejs.org](https://nodejs.org/). On the Python installer, tick
> **"Add python.exe to PATH"** on the first screen. Missing that box is the
> single most common cause of `python: command not found` on Windows.

### Install

```powershell
git clone https://github.com/yashwanth-95/LostIntoSpacE.git
cd LostIntoSpacE
Copy-Item .env.example .env

python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -e "apps/api[dev]"
pip install "httpx>=0.27" respx numpy pydantic
```

> **"running scripts is disabled on this system"** — PowerShell blocks script
> execution by default. Allow it for your own account only:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
>
> This does not weaken anything system-wide; it permits locally created scripts
> for your user. Alternatively use `cmd.exe` and `.venv\Scripts\activate.bat`.

### Run

Two terminals, both with the virtualenv activated in the first.

```powershell
# Terminal 1 — API
cd apps\api
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn src.main:app --reload --port 8000
```

```powershell
# Terminal 2 — web
cd apps\web
npm install
npm run dev
```

> **PowerShell has no `&&`.** Windows PowerShell 5.1 (the version that ships with
> Windows) does not support `A && B`. Use separate lines, or `A; if ($?) { B }`.
> PowerShell 7+ does support it.

---

## macOS

### Prerequisites

With [Homebrew](https://brew.sh/):

```bash
brew install python@3.12 node git
brew install postgresql@16          # optional
brew services start postgresql@16   # optional
```

Apple Silicon and Intel are both fine; Homebrew installs to `/opt/homebrew` on
Apple Silicon and `/usr/local` on Intel, and puts the right one on your `PATH`.

> **Do not use the system Python.** macOS ships `/usr/bin/python3` for its own
> use. It is not upgradable, and installing into it needs `sudo` — which is a
> sign you are about to modify something the OS depends on. Homebrew's Python
> and a virtualenv keep your work entirely out of the system's way.

### Install and run

```bash
git clone https://github.com/yashwanth-95/LostIntoSpacE.git
cd LostIntoSpacE
cp .env.example .env

python3 -m venv .venv
source .venv/bin/activate

pip install -e "apps/api[dev]"
pip install "httpx>=0.27" respx numpy pydantic

# Terminal 1
cd apps/api && PYTHONPATH=$PWD python -m uvicorn src.main:app --reload --port 8000

# Terminal 2
cd apps/web && npm install && npm run dev
```

> **Port 5000 is taken by AirPlay Receiver** on recent macOS. This project uses
> 8000 and 3000, so it is unaffected — but if you remap ports, avoid 5000.

---

## Debian, Ubuntu, Mint, Pop!_OS

### Prerequisites

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git curl build-essential
```

`python3-venv` is a **separate package** on Debian and its derivatives. Without
it, `python3 -m venv` fails with `ensurepip is not available` — which reads like
a Python bug and is actually a missing apt package. This trips up more people
than any other step on Debian.

Check your Python version, because the API needs 3.11 or newer:

```bash
python3 --version
```

| Release | Ships | Action |
|---|---|---|
| Ubuntu 24.04 LTS | 3.12 | Ready to go |
| Ubuntu 22.04 LTS | 3.10 | **Too old** — add the deadsnakes PPA below |
| Debian 13 (trixie) | 3.13 | Ready to go |
| Debian 12 (bookworm) | 3.11 | Ready to go |
| Debian 11 (bullseye) | 3.9 | **Too old** — use backports, pyenv, or Docker |
| Mint 21 | 3.10 | **Too old** — deadsnakes PPA |
| Mint 22 | 3.12 | Ready to go |

For Ubuntu and Mint releases that are too old:

```bash
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.12 python3.12-venv
python3.12 -m venv .venv          # note: 3.12, not 3
```

Node.js in Debian's own repositories is usually several major versions behind.
Use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

PostgreSQL, if you want persistence:

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

### Install and run

```bash
git clone https://github.com/yashwanth-95/LostIntoSpacE.git
cd LostIntoSpacE
cp .env.example .env

python3 -m venv .venv
source .venv/bin/activate

pip install -e "apps/api[dev]"
pip install "httpx>=0.27" respx numpy pydantic

# Terminal 1
cd apps/api && PYTHONPATH=$PWD python -m uvicorn src.main:app --reload --port 8000

# Terminal 2
cd apps/web && npm install && npm run dev
```

---

## Fedora, RHEL, CentOS Stream, Rocky, Alma

### Prerequisites

```bash
sudo dnf install -y python3 python3-pip python3-devel git nodejs gcc
sudo dnf install -y postgresql-server postgresql-contrib   # optional
```

Fedora 39 and later ship Python 3.12, so nothing extra is needed. On RHEL 9,
Rocky 9 and Alma 9 the default is 3.9 — install a newer one alongside it:

```bash
sudo dnf install -y python3.12 python3.12-devel
python3.12 -m venv .venv
```

`venv` is part of the base Python package here, so unlike Debian there is no
separate package to remember.

PostgreSQL on the Red Hat family needs its data directory created before the
service will start, which is a step Debian does for you:

```bash
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

> **SELinux is enforcing by default** on this family. It does not interfere with
> anything here — the servers bind to high ports and read only files you own. If
> you later put nginx in front of the API, SELinux will block the proxy
> connection until you run `sudo setsebool -P httpd_can_network_connect on`.

### Install and run

Identical to the Debian block above, using `python3` (or `python3.12` on RHEL 9).

---

## Arch, Manjaro, EndeavourOS

### Prerequisites

```bash
sudo pacman -Syu
sudo pacman -S --needed python python-pip nodejs npm git base-devel
sudo pacman -S --needed postgresql   # optional
```

**On Arch, `python` is Python 3.** There is no `python3-venv` package and no
`python3` to type — `venv` is in the standard library and the binary is called
`python`. Arch also tracks upstream closely, so the Python and Node versions in
the repositories are current by definition and there is no version table here to
consult.

> **PEP 668 — "externally-managed-environment".** Arch marks its system Python
> as managed by pacman, so `pip install` outside a virtualenv is refused. This
> is a good thing and you should not work around it with `--break-system-packages`:
> the venv below is the correct answer, and it is what this guide uses anyway.

PostgreSQL on Arch needs its cluster initialised by hand, as the root `postgres`
user:

```bash
sudo -u postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
```

### Install and run

```bash
git clone https://github.com/yashwanth-95/LostIntoSpacE.git
cd LostIntoSpacE
cp .env.example .env

python -m venv .venv          # `python`, not `python3`
source .venv/bin/activate

pip install -e "apps/api[dev]"
pip install "httpx>=0.27" respx numpy pydantic

# Terminal 1
cd apps/api && PYTHONPATH=$PWD python -m uvicorn src.main:app --reload --port 8000

# Terminal 2
cd apps/web && npm install && npm run dev
```

---

## openSUSE

### Prerequisites

```bash
sudo zypper refresh
sudo zypper install -y python311 python311-devel python311-pip git nodejs20 npm20 gcc
sudo zypper install -y postgresql-server   # optional
```

openSUSE names its Python packages with the version attached, and the binary
follows: you get `python3.11`, not a generic `python3` pointing at it. Tumbleweed
is rolling and ships a current Python as plain `python3`.

```bash
python3.11 -m venv .venv       # Leap
python3 -m venv .venv          # Tumbleweed
source .venv/bin/activate
```

The rest is identical to the Debian block.

---

## Alpine

Alpine uses musl rather than glibc, so Python wheels compiled for
`manylinux` do not install and NumPy has to be built from source — or taken from
Alpine's own repository, which is far quicker:

```sh
apk add --no-cache python3 py3-pip py3-numpy nodejs npm git \
    build-base python3-dev linux-headers
```

Create the virtualenv with access to the system NumPy, so pip does not try to
rebuild it:

```sh
python3 -m venv --system-site-packages .venv
source .venv/bin/activate

pip install -e "apps/api[dev]"
pip install "httpx>=0.27" respx pydantic
```

Alpine is the reason the Docker route below exists. If you are only trying to
run the project rather than to deploy it small, use Docker instead.

---

## Docker (any OS)

The shortest path, and the one that does not care what your distribution ships.

**Requires:** Docker Engine 20.10+ and the Compose plugin. On Windows and macOS,
[Docker Desktop](https://www.docker.com/products/docker-desktop/) includes both.

```bash
git clone https://github.com/yashwanth-95/LostIntoSpacE.git
cd LostIntoSpacE
cp .env.example .env

docker compose up --build
```

Then open <http://localhost:3000>.

This brings up the API, the web app and PostgreSQL together, with the database
already created and migrated. To stop it, `Ctrl+C`; to remove the volumes as
well, `docker compose down -v`.

> **`docker-compose` vs `docker compose`** — the hyphenated form is Compose v1,
> which reached end of life in 2023. If `docker compose` is not recognised,
> install the plugin: `sudo apt install docker-compose-plugin` on Debian and
> Ubuntu, `sudo dnf install docker-compose-plugin` on Fedora.

---

## Verify the install

With both servers running:

```bash
curl localhost:8000/api/v1/health
curl localhost:8000/api/v1/health/engines
```

`/health/engines` should report `simulation`, `search` and `ai` as available. A
`false` there names the missing import in its `reason` field, and that is almost
always a dependency that did not install.

Then the full journey — 56 checks across the whole loop:

```bash
cd apps/web && npx tsx e2e/journey.mjs
```

And the test suites:

```bash
pytest                                          # Python: physics, data, AI, API
cd packages/simulation-engine && npm test       # TypeScript engine
cd apps/web && npm run typecheck                # Web app
```

---

## Do I need a database?

**No, not to see the product work.** The rocket builder, the destination
planner, the flight simulation, mission control, search and the AI assistant all
run with no database at all — the API starts without one on purpose, and says so
at `/health`.

PostgreSQL adds two things: your saved designs and flights persist between
sessions, and the Explore catalogue is served from it. Without it, Explore shows
a setup panel rather than an empty grid, because "not connected" and "no results"
are different problems and only one of them is your fault.

Setting it up is [step 4 of `LOCAL_SETUP.md`](LOCAL_SETUP.md).

---

## Troubleshooting

**`ensurepip is not available`** — Debian, Ubuntu or Mint without
`python3-venv`. `sudo apt install python3-venv`.

**`externally-managed-environment`** — you are pip-installing outside a
virtualenv on a distribution that follows PEP 668 (Arch, Debian 12+, Fedora 38+,
Ubuntu 23.04+). Activate the venv. Do not pass `--break-system-packages`.

**`python: command not found` on Linux** — use `python3`. On Arch, use `python`.
See [the table above](#the-one-difference-that-catches-everyone).

**`python3: command not found` on Windows, or it opens the Microsoft Store** —
use `python`. If that also fails, Python was installed without being added to
`PATH`; re-run the installer and choose *Modify → Add to environment variables*.

**`ModuleNotFoundError: No module named 'src'`** — `PYTHONPATH` is not set. The
API is started from `apps/api` with `PYTHONPATH` pointing at that directory; see
the run commands above.

**`EADDRINUSE` on port 3000 or 8000** — something else holds the port.
`lsof -i :8000` on macOS and Linux, `netstat -ano | findstr :8000` on Windows.

**Node build fails with an old Node** — check `node --version`. This project
needs 18 or newer; Vite 5 will not run on 16.

**`psycopg` fails to build** — install the PostgreSQL client headers:
`libpq-dev` (Debian), `postgresql-devel` (Fedora), `postgresql-libs` (Arch).

---

## Where to go next

- [`LOCAL_SETUP.md`](LOCAL_SETUP.md) — the database, migrations, seed data, and
  every step in more detail.
- [`ENVIRONMENT.md`](ENVIRONMENT.md) — every environment variable, what it does,
  and which are optional.
- [`../simulation/ASSUMPTIONS.md`](../simulation/ASSUMPTIONS.md) — what the
  physics approximates, and where it stops being accurate.
