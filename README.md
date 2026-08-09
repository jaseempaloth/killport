<p align="center">
  <br/>
  <code>⚓ killport</code>
  <br/>
  <strong>See every port in use. Kill what you don't need. One command.</strong>
  <br/><br/>
  <a href="#install"><img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-8B5CF6?style=flat-square" alt="Platform"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.12-34D399?style=flat-square" alt="Node"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-60A5FA?style=flat-square" alt="License"></a>
  <br/><br/>
</p>

---

Every developer hits this: _"What's on port 3000?"_ → Google → `lsof -iTCP -sTCP:LISTEN -P -n | grep 3000` → pipe through `awk` → copy the PID → `kill -9` → pray.

**killport** replaces all of that with one command. A clean TUI that scans your machine, shows every listening port in a color-coded table, and lets you kill any process interactively — or scriptably.

```
  ╔════════════════════════════════════════╗
  ║  ⚓ killport  — port manager for devs  ║
  ╚════════════════════════════════════════╝

  ┌──────┬──────────┬──────────┬──────────────────────┬──────────────┬────────────────────┬────────┬──────────┐
  │ #    │ PORT     │ PID      │ PROCESS              │ USER         │ ADDRESS            │ PROTO  │ TYPE     │
  ├──────┼──────────┼──────────┼──────────────────────┼──────────────┼────────────────────┼────────┼──────────┤
  │ 1    │ :3000    │ 42019    │ node                 │ dev          │ 127.0.0.1          │ TCP    │ dev      │
  ├──────┼──────────┼──────────┼──────────────────────┼──────────────┼────────────────────┼────────┼──────────┤
  │ 2    │ :5000    │ 604      │ ControlCenter        │ dev          │ 0.0.0.0            │ TCP    │ check    │
  ├──────┼──────────┼──────────┼──────────────────────┼──────────────┼────────────────────┼────────┼──────────┤
  │ 3    │ :5432    │ 789      │ postgres             │ postgres     │ 0.0.0.0            │ TCP    │ check    │
  ├──────┼──────────┼──────────┼──────────────────────┼──────────────┼────────────────────┼────────┼──────────┤
  │ 4    │ :8080    │ 12911    │ java                 │ dev          │ 0.0.0.0            │ TCP    │ dev      │
  └──────┴──────────┴──────────┴──────────────────────┴──────────────┴────────────────────┴────────┴──────────┘

  ℹ system/priv are protected · app/check means review before killing · 4 ports listening

  ? Choose an action
    Kill a port
    Rescan
  ❯ Exit
```

---

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Interactive Mode](#interactive-mode)
  - [Filter by Port](#filter-by-port)
  - [Direct Kill](#direct-kill)
  - [Force Kill](#force-kill)
  - [Protected Processes](#protected-processes)
  - [Filter by Process](#filter-by-process)
  - [JSON Output](#json-output)
- [CLI Reference](#cli-reference)
- [How It Works](#how-it-works)
- [Security & Trust](#security--trust)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Install

### Global install (recommended)

```bash
npm install -g killport
```

Then run from anywhere:

```bash
killport
```

### Run without installing

```bash
npx killport
```

### From source

```bash
git clone https://github.com/jaseempaloth/killport.git
cd killport
npm install
npm link     # symlinks the `killport` command globally
```

### Requirements

| Dependency | Version |
|------------|---------|
| Node.js    | ≥ 20.12 |
| OS         | macOS or Linux |

---

## Quick Start

```bash
# See all listening ports and kill one interactively
killport

# What's on port 3000?
killport -p 3000

# Show only Node.js listeners
killport --process node

# Just kill port 3000, no questions asked
killport -k 3000

# Pipe port data into another tool
killport --json | jq '.[] | select(.port == 8080)'
```

---

## Usage

### Interactive Mode

```bash
killport
```

The default experience. killport scans your machine and presents:

1. **Port table** — every listening TCP port, sorted by port number
2. **Action menu** — choose `Kill a port`, `Rescan`, or `Exit`
3. **Confirmation** — asks before sending SIGTERM
4. **Safety check** — system/app-looking processes ask for extra confirmation
5. **Graceful escalation** — if the process survives SIGTERM, offers SIGKILL

The `TYPE` column helps separate likely dev servers from things you probably should not kill:

| Type | Meaning |
|------|---------|
| `dev` | Common development process such as `node`, `python`, `java`, or `vite` |
| `app` | Browser/editor/app support process; review before killing |
| `check` | Unknown process; check the PID before killing |
| `system` | Known macOS service; protected from direct kill by default |
| `priv` | Privileged port below 1024; protected from direct kill by default |

### Filter by Port

```bash
killport --port 3000
# or
killport -p 3000
```

Shows only the process listening on port 3000. Still enters interactive mode if a match is found.

### Direct Kill

```bash
killport --kill 3000
# or
killport -k 3000
```

Non-interactive. Finds the process on port 3000 and sends **SIGTERM** immediately. Useful in scripts or when you know exactly what you want dead.

If the process doesn't exit within 500ms, killport reports that it is still running. Re-run with `--force` to send SIGKILL.

### Force Kill

```bash
killport --kill 3000 --force
# or
killport -k 3000 -f
```

Skips SIGTERM entirely and sends **SIGKILL** (signal 9). The process is terminated immediately with no chance to clean up. Use when graceful shutdown isn't working.

### Protected Processes

```bash
killport --kill 5000
# Refuses protected system/privileged entries by default

killport --kill 5000 --allow-protected
# Allows the kill if you are sure
```

Known system services and privileged ports are protected from direct `--kill` by default. In interactive mode, killport shows a warning badge and asks for one more confirmation before killing app/system-looking processes.

### Filter by Process

```bash
killport --process node
# or
killport --proc postgres
```

Filters the table or JSON output to command names containing the given text. Matching is case-insensitive.

### JSON Output

```bash
killport --json
```

Outputs the port list as a JSON array — perfect for piping into `jq`, scripts, or monitoring tools.

```json
[
  {
    "protocol": "TCP",
    "localAddress": "127.0.0.1",
    "port": 3000,
    "pid": 42019,
    "process": "node",
    "user": "dev",
    "state": "LISTEN"
  }
]
```

Combine with `--port` to filter:

```bash
killport --json --port 5432
```

---

## CLI Reference

```
killport [options]
```

| Option | Short | Argument | Description |
|--------|-------|----------|-------------|
| `--port` | `-p` | `<number>` | Filter results to a specific port |
| `--process` | — | `<text>` | Filter results by process name |
| `--proc` | — | `<text>` | Alias for `--process` |
| `--kill` | `-k` | `<number>` | Kill the process on a port (non-interactive) |
| `--force` | `-f` | — | Send SIGKILL instead of SIGTERM (use with `--kill`) |
| `--allow-protected` | — | — | Permit direct kill for protected system/privileged entries |
| `--json` | — | — | Output port data as JSON |
| `--help` | `-h` | — | Show help text |
| `--version` | `-v` | — | Print version number |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | No process found on the specified port, or kill failed |

---

## How It Works

killport uses **`lsof`** under the hood — the same tool you'd use manually, but it handles the ugly syntax for you.

```
lsof -iTCP -sTCP:LISTEN -P -n
```

| Flag | What it does |
|------|-------------|
| `-iTCP` | Show only TCP connections |
| `-sTCP:LISTEN` | Filter to LISTEN state only |
| `-P` | Don't resolve port numbers to service names |
| `-n` | Don't resolve IP addresses to hostnames |

The raw output is parsed, de-duplicated (same PID + port shown once, even if listening on both IPv4 and IPv6), and sorted by port number.

### Kill Flow

```
SIGTERM (graceful) → wait 500ms → still alive? → offer SIGKILL (force)
```

- **SIGTERM** (signal 15): Asks the process to shut down cleanly. Most well-written processes handle this.
- **SIGKILL** (signal 9): Forces immediate termination. The process gets no chance to clean up (close files, release sockets, etc).

### Linux Fallback

On Linux, if `lsof` isn't installed, killport falls back to:

```bash
netstat -tlnp || ss -tlnp
```

---

## Security & Trust

killport is a local-only, read-then-act tool. Here's exactly what it does and doesn't do — you can verify every claim by reading the source (it's ~400 lines total).

### Permissions Model

| Action | What runs under the hood | Scope |
|--------|--------------------------|-------|
| **Scan ports** | `lsof -iTCP -sTCP:LISTEN -P -n` | Read-only. Lists open sockets — identical to running `lsof` yourself. |
| **Kill a process** | Node `process.kill(pid, 'SIGTERM')` or `process.kill(pid, 'SIGKILL')` | Write. Only executes after explicit user confirmation in interactive mode. |
| **Check if alive** | Node `process.kill(pid, 0)` | Read-only. Signal 0 checks existence without affecting the process. |

### What killport does NOT do

- **No network requests** — zero outbound connections, no telemetry, no analytics, no update checks
- **No file system writes** — no config files, no logs, no temp files, no dotfiles
- **No background processes** — runs, shows results, exits. Nothing lingers.
- **No access to secrets** — doesn't read environment variables, keychains, SSH keys, or credentials
- **No shell injection** — port scanning uses structured command arguments, and process signals use Node's `process.kill()` API

### Kill Safety

The kill flow is designed to prevent accidents:

```
1. You see the full port table with process names and PIDs
2. You arrow-key select a specific process
3. Confirmation prompt asks "Kill <process> on :<port>?" → default: No
4. SIGTERM sent (graceful shutdown)
5. If process survives in interactive mode → second prompt: "Force kill?" → default: No
```

- In **interactive mode**: two confirmation gates before anything dies
- In **`--kill` mode**: sends SIGTERM first (graceful), and uses SIGKILL only with explicit `--force`
- killport can only kill processes **owned by your user** — system processes require `sudo`

### Dependencies

| Package | Downloads/week | Purpose | Network access |
|---------|---------------|---------|----------------|
| [chalk](https://www.npmjs.com/package/chalk) | ~250M | Terminal colors | None |
| [cli-table3](https://www.npmjs.com/package/cli-table3) | ~30M | Table rendering | None |
| [inquirer](https://www.npmjs.com/package/inquirer) | ~40M | Interactive prompts | None |
| [ora](https://www.npmjs.com/package/ora) | ~40M | Spinner animation | None |

All four are widely audited, maintained, and have **zero network capabilities**. Total dependency tree: 52 packages, all pure formatting/UI utilities.

### Audit it yourself

```bash
# Check the full dependency tree
npm ls --all

# Verify no install/postinstall scripts run hidden code
npm pkg get scripts

# Read the entire source — it's 3 files
wc -l src/*.js   # ~520 lines total
```

---

## Architecture

```
killport/
├── bin/
│   └── killport.js          # CLI entry point (shebang + ESM import)
├── src/
│   ├── index.js            # Main orchestrator
│   │                         ├── Argument parsing
│   │                         ├── Interactive kill flow (inquirer prompts)
│   │                         ├── Direct kill flow
│   │                         └── JSON output mode
│   ├── ports.js             # Port scanning & process management
│   │                         ├── parseLsof()      — macOS/Linux primary
│   │                         ├── parseNetstat()    — Linux fallback
│   │                         ├── getListeningPorts()
│   │                         ├── killProcess()
│   │                         └── isProcessRunning()
│   └── display.js           # TUI rendering layer
│                             ├── Theme (color tokens)
│                             ├── printBanner()
│                             ├── printPortTable()
│                             ├── printKillSuccess()
│                             └── printKillError()
├── package.json
└── README.md
```

### Dependencies

| Package | Purpose |
|---------|---------|
| [chalk](https://github.com/chalk/chalk) v5 | Terminal string styling (ESM) |
| [cli-table3](https://github.com/cli-table/cli-table3) | Unicode table rendering |
| [inquirer](https://github.com/SBoudrias/Inquirer.js) | Interactive prompts (list, confirm) |
| [ora](https://github.com/sindresorhus/ora) | Elegant terminal spinners |

Zero native dependencies. Pure JavaScript.

---

## API Reference

killport is primarily a CLI, but the core modules can be imported directly.

### `ports.js`

#### `getListeningPorts(): PortEntry[]`

Scans the machine and returns all listening TCP ports.

```js
import { getListeningPorts } from './src/ports.js';

const ports = getListeningPorts();
// [{ protocol, localAddress, port, pid, process, user, state }, ...]
```

**Returns:**

| Field | Type | Description |
|-------|------|-------------|
| `protocol` | `string` | `"TCP"` or `"TCP6"` |
| `localAddress` | `string` | Bind address (e.g., `"127.0.0.1"`, `"0.0.0.0"`) |
| `port` | `number` | Port number |
| `pid` | `number` | Process ID |
| `process` | `string` | Process/command name |
| `user` | `string` | Owner username |
| `state` | `string` | Always `"LISTEN"` |

#### `killProcess(pid: number, force?: boolean): void`

Sends a signal to terminate a process.

```js
import { killProcess } from './src/ports.js';

killProcess(42019);         // SIGTERM (graceful)
killProcess(42019, true);   // SIGKILL (force)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pid` | `number` | — | Process ID to kill |
| `force` | `boolean` | `false` | `true` = SIGKILL, `false` = SIGTERM |

**Throws:** If the `kill` command fails (e.g., permission denied).

#### `isProcessRunning(pid: number): boolean`

Checks whether a process is still alive.

```js
import { isProcessRunning } from './src/ports.js';

isProcessRunning(42019);  // true or false
```

### `display.js`

#### Theme Tokens

The display module exports a `theme` object with styled chalk functions:

| Token | Color | Use |
|-------|-------|-----|
| `theme.brand` | Violet `#A78BFA` | Branding, headers |
| `theme.accent` | Emerald `#34D399` | Success indicators |
| `theme.warn` | Amber `#FBBF24` | Privileged ports, warnings |
| `theme.danger` | Red `#F87171` | Errors, failures |
| `theme.muted` | Gray `#6B7280` | Secondary text |
| `theme.port` | Sky Blue `#60A5FA` | Port numbers |
| `theme.pid` | Purple `#C084FC` | Process IDs |
| `theme.process` | Pink `#F9A8D4` | Process names |
| `theme.user` | Cyan `#67E8F9` | Usernames |

---

## Troubleshooting

### "No listening ports found" but I know ports are in use

On macOS, `lsof` may not show ports owned by other users unless you run with elevated privileges:

```bash
sudo killport
```

### "Permission denied" when killing a process

The process is owned by another user or is a system service. Escalate:

```bash
sudo killport --kill 80
```

### Ports show `ControlCe` as the process name

That's macOS **Control Center** — it uses ports 5000 and 7000 for AirPlay Receiver. You can disable it in **System Settings → General → AirDrop & Handoff → AirPlay Receiver**.

### Process names are truncated

`lsof` truncates command names to ~9 characters by default (e.g., `language_` instead of `language_server`). This is a limitation of `lsof`, not killport. The PID is always accurate — you can use `ps -p <PID> -o comm=` to see the full command.

### killport doesn't work on Windows

killport relies on Unix tools (`lsof`, `kill`) and is designed for **macOS** and **Linux** only. On Windows, consider using `netstat -ano` or [TCPView](https://learn.microsoft.com/en-us/sysinternals/downloads/tcpview).

---

## Common Recipes

### Kill everything on port 3000 in a script

```bash
killport --kill 3000 --force 2>/dev/null || true
```

### List all Node.js processes with ports

```bash
killport --json | jq '.[] | select(.process == "node")'
```

### Watch ports in real time

```bash
watch -n 2 'killport --json | jq length'
```

### Check if a port is free before starting a server

```bash
if killport --json --port 3000 | jq -e 'length > 0' > /dev/null 2>&1; then
  echo "Port 3000 is taken!"
  killport --kill 3000
fi
npm start
```

### Count listening ports

```bash
killport --json | jq length
```

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

### Development

```bash
git clone https://github.com/jaseempaloth/killport.git
cd killport
npm install

# Run locally
node bin/killport.js

# Link globally for testing
npm link
killport
```

---

## License

MIT © Jaseem Paloth
