# k8stui vs k9s Comparison

Feature comparison between k8stui and [k9s](https://github.com/derailed/k9s) (v0.51.x).

## What k8stui is MISSING vs k9s

| Feature | k9s | k8stui |
|---|---|---|
| CRD/dynamic resource discovery | Auto-discovers all CRDs via `ServerPreferredResources` | Dynamic discovery via raw K8s API (`/apis`) + detail page (YAML & metadata). No custom columns, label selectors, or command-mode jumps on CRDs |
| Command mode (`:`) | Type `:pod`, `:dp`, `:svc ns-x` to jump anywhere | Stack-based navigation only, no command bar |
| Resource filtering | Regex, inverse regex, label selectors, fuzzy find | Name search on clusters page only |
| Shell into pods | `s` key | Not supported |
| Attach to containers | `a` key | Not supported |
| Delete resources | `ctrl-d` with confirmation on any resource | Delete secrets only |
| Kill resources | `ctrl-k` (no confirmation) | Not supported |
| Scale workloads | Edit replicas on Deployments/STS/RS | Not supported |
| Rollout restart | `r` key on Deployments/DaemonSets/STS | Not supported |
| Cordon/Drain nodes | `u` cordon, `r` drain | Not supported |
| Node shell | Feature-gated privileged pod shell | Not supported |
| Helm integration | Full Helm SDK (list, values, history, uninstall) | Not supported |
| RBAC viewing | `:rbac`, `:policy`, `:users`, `:groups` | Not supported |
| XRay (topology view) | Parent-child resource graph | Not supported |
| Pulses (cluster health) | Aggregated health dashboard | Not supported |
| Popeye (cluster sanitizer) | Misconfiguration scanning | Not supported |
| HTTP benchmarking | Integrated Hey on services/port-forwards | Not supported |
| Image vulnerability scanning | Built-in scanner | Not supported |
| Plugin system | Full plugin YAML with shortcuts, scopes, env vars | Not supported |
| Hotkeys/aliases | Custom keybindings and command aliases | Not supported |
| Skins/themes | 30+ built-in, fully customizable | Not supported |
| Custom column views | `views.yaml` per-resource column config | Not supported |
| Resource jumps | Custom cross-resource navigation | Not supported |
| Mark/select resources | Space to mark, bulk actions | Not supported |
| Sort by any column | Shift-O on any column | Sort clusters only |
| Screen dumps | Save/restore view state | Not supported |
| Read-only mode | `--readonly` flag | Not supported |
| CronJob trigger | `t` key creates manual Job | Not supported |
| Describe resources | `d` key on any resource | Not supported (YAML view only) |
| Fullscreen toggle | `f` on logs/YAML/details | Not supported |
| Cross-context view | `:pod @other-context` | Switch entire session only |
| Per-cluster config | Namespace favorites, feature gates, skins per context | Not supported |
| Auto-refresh all views | Configurable refresh rate (2s+) | Cluster status polls at 5s |
| GPU metrics | nvidia/amd/intel GPU tracking | Not supported |

## What k8stui has as ADVANTAGES over k9s

| Feature | k8stui | k9s |
|---|---|---|
| SSH-based .env secret sync | Register secrets with remote `.env` files via SSH, bi-directional sync, diff comparison, inline editor | No equivalent — just view/decode secrets |
| Atomic .env write | Temp file + rename + verify, production-grade | No equivalent |
| Secret diff view | Side-by-side matching/different/new/removed keys when registering | No equivalent |
| Env editor modal | Full inline `.env` editor with add/edit/delete/mask/save | No equivalent |
| Direct API log streaming | Uses `@kubernetes/client-node` + native HTTPS, auto-reconnect with exponential backoff | Shells out to `kubectl logs` |
| Per-resource manifest browsing | Manifests box shows YAML per application resource individually (Deployment, PVC, Secret, Service, etc.) | Single YAML dump, no per-resource breakdown |
| YAML edit+apply inline | Edit in TUI, `Ctrl+Enter` to apply — no external editor | Opens `$EDITOR` (leaves TUI) |
| OSC 52 clipboard | Works over SSH sessions | Native clipboard only (osc52 via env var) |
| Ownership chain resolution | Pod -> RS -> Deployment, then fetches all related resources by label selector + volume refs | Jump to owner only (no aggregated view) |
| Sensitive value auto-masking | Keys containing password/secret/token/key/credential auto-masked in env editor | No equivalent |
| Context-aware commands bar | Bottom bar shows available keys per page | `?` help overlay |
| Favorite clusters | `[f]` to pin clusters to top | No equivalent |
| Node utilization bars | Visual CPU/memory bars | Numeric thresholds only |
| CRD structured metadata panel | DetailsPanel with Kind, Name, Namespace, Labels, Annotations, Owners, Finalizers, etc. for any CRD | Raw YAML only, no structured breakdown |

## Summary

**k8stui's biggest gap**: breadth of interactions. k9s supports ~any Kubernetes resource (including CRDs) with 20+ actions (shell, delete, scale, restart, drain, describe, etc.), while k8stui covers 13 built-in kinds + all CRDs dynamically, but with fewer actions (no delete/scale/restart/drain on CRDs yet).

**k8stui's unique strength**: the SSH/.env secret management system is genuinely novel — nothing in k9s or any other K8s TUI offers bi-directional sync between cluster secrets and remote `.env` files. The inline YAML editing (vs leaving TUI for `$EDITOR`), direct API log streaming with auto-reconnect, and structured CRD metadata panels are also notable advantages.
