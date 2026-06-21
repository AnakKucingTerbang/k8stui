# k8stui

Opinionated terminal UI for managing Kubernetes clusters. Built with OpenTUI + React on Bun. Favors sensible defaults and guided workflows over raw kubectl flag sprawl.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0 — required runtime (OpenTUI uses native FFI)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) — must be on PATH and configured with a kubeconfig

## Install

### Option 1: bunx (recommended)

No install step — run directly:

```bash
bunx k8stui
```

This downloads and executes k8stui in one command. Bun handles the rest.

### Option 2: npx

```bash
npx k8stui
```

Note: k8stui requires Bun (not Node.js). If Bun is installed, `npx` will use it via the shebang. If Bun is missing, `npx` will fail with an error.

### Option 3: curl | sh installer

Installs a `k8stui` command to `~/.local/bin` so you can run it anytime:

```bash
curl -fsSL https://raw.githubusercontent.com/AnakKucingTerbang/k8stui/main/install.sh | bash
```

Then:

```bash
k8stui
```

The installer will:

- Check for Bun (offer to install if missing)
- Check for kubectl (exit if missing)
- Create `~/.local/bin/k8stui` wrapper script
- Add `~/.local/bin` to your PATH if needed

## Usage

| Key | Action |
|---|---|
| `up/down` | Navigate list |
| `enter` | Open cluster / node detail |
| `esc` | Go back |
| `m` | Toggle metric mode (percentage / raw values) |
| `s` | Sort clusters |
| `/` | Search clusters |
| `f` | Toggle favorite |
| `c` | Switch Kubernetes context |
| `q` | Quit |

## Navigation

```
cluster list  →  cluster detail (overview + nodes)  →  node detail (bars + pods)
```

The header breadcrumb extends as you navigate deeper.

## License

[Apache-2.0](LICENSE)
