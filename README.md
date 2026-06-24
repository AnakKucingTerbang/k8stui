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

### Option 2: curl | sh installer

Installs a `k8stui` command to `~/.local/bin` so you can run it anytime:

```bash
curl -fsSL https://raw.githubusercontent.com/AnakKucingTerbang/k8stui/main/install.sh | bash
```

For CI or non-interactive use:

```bash
curl -fsSL https://raw.githubusercontent.com/AnakKucingTerbang/k8stui/main/install.sh | bash -s -- --yes
```

Then:

```bash
k8stui
```

The installer will:

- Check for Bun (offer to install if missing, or auto-accept with `--yes`)
- Check for kubectl (warn if missing, continue anyway)
- Create `~/.local/bin/k8stui` wrapper script
- Add `~/.local/bin` to your PATH if needed

### Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/AnakKucingTerbang/k8stui/main/install.sh | bash -s -- --uninstall
```

This removes the `~/.local/bin/k8stui` wrapper. The PATH entry is left alone (other tools may use `~/.local/bin`).

## Features

- Two-pane layout with VIEWS sidebar and arrow-key focus switching
- YAML editing with `ctrl+enter` to apply changes
- Pod log streaming with time range filters (live, 5m, 30m, 3h)
- Secret value reveal/mask with clipboard copy
- Clipboard copy on any detail row
- Auto-refreshing cluster status (5s poll)

## Navigation

```
clusters
 └── cluster detail (overview + nodes/namespaces/resources)
      ├── nodes → node detail (pods, conditions)
      ├── namespaces → namespace detail
      │   ├── workloads → workload detail → pod
      │   ├── pods → pod detail
      │   ├── network → network detail → pod
      │   └── config → config detail / secret detail → pod
      └── resources → (workload / network / storage / config) → pod
```

The header breadcrumb extends as you navigate deeper. Keybindings are shown in the COMMANDS bar at the bottom of every page.

## License

[Apache-2.0](LICENSE)
