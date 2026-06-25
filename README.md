# k8stui

Opinionated terminal UI for managing Kubernetes clusters. Built with OpenTUI + React on Bun. Favors sensible defaults and guided workflows over raw kubectl flag sprawl.

## Prerequisites

- [kubectl](https://kubernetes.io/docs/tasks/tools/) — must be on PATH and configured with a kubeconfig

## Install

No runtime needed — downloads a self-contained binary:

```bash
curl -fsSL https://raw.githubusercontent.com/AnakKucingTerbang/k8stui/main/install.sh | bash
```

Then:

```bash
k8stui
```

The installer will:

- Detect your OS and architecture
- Download the latest binary from GitHub Releases
- Install to `~/.local/bin/k8stui`
- Add `~/.local/bin` to your PATH if needed
- Check for kubectl (warn if missing, continue anyway)

### Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/AnakKucingTerbang/k8stui/main/install.sh | bash -s -- --uninstall
```

This removes `~/.local/bin/k8stui`. The PATH entry is left alone (other tools may use `~/.local/bin`).

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

## Releasing

1. Run `bunx release-it` — bumps version, updates CHANGELOG, commits, tags, pushes
2. GitHub Actions builds binaries for all platforms and attaches them to the GitHub Release

Supported platforms:

| Binary | OS | Arch | Libc |
|---|---|---|---|
| `k8stui-macos-arm64` | macOS | Apple Silicon | — |
| `k8stui-macos-x64` | macOS | Intel | — |
| `k8stui-linux-x64` | Linux | x86_64 | glibc |
| `k8stui-linux-x64-musl` | Linux | x86_64 | musl |
| `k8stui-linux-arm64` | Linux | ARM64 | glibc |

## License

[Apache-2.0](LICENSE)
