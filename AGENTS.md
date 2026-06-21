# k8cli

Opinionated terminal UI for managing Kubernetes clusters. Built with OpenTUI + React on Bun. Favors sensible defaults and guided workflows over raw kubectl flag sprawl.

## Stack

- **Runtime**: Bun (required for native FFI — OpenTUI's Zig renderer needs it)
- **UI framework**: OpenTUI (`@opentui/core` + `@opentui/react` + `react`)
- **Language**: TypeScript

## Setup

```bash
bun init -y
bun add @opentui/core @opentui/react react
```

## OpenTUI + React conventions

- **JSX elements are lowercase**: `<text>`, `<box>`, `<input>`, `<textarea>`, `<select>`, `<scrollbox>`, `<code>`, `<diff>`, `<markdown>`. Not PascalCase like web React.
- **Core factory functions** (non-JSX path) are PascalCase: `Box({...}, children)`, `Text({...})`.
- **tsconfig must set** `"jsxImportSource": "@opentui/react"` or JSX will compile against the wrong runtime.
- **`createCliRenderer()` is async** — always `await` it. It loads the native Zig library and configures the terminal.
- **`renderer.destroy()` is mandatory** for cleanup. OpenTUI does not auto-cleanup on `process.exit` or unhandled errors.
- **Runtime plugin support** (if loading external TS/TSX at runtime): import `@opentui/react/runtime-plugin-support` once before dynamic imports.

## Testing

Use `createTestRenderer` from `@opentui/core/testing` — renders to memory, no real terminal needed:

```typescript
import { createTestRenderer } from "@opentui/core/testing"
const { renderer, renderOnce, captureCharFrame } = await createTestRenderer({ width: 80, height: 24 })
```

Key helpers: `renderOnce()`, `flush()`, `waitFor(predicate)`, `waitForFrame(predicate)`, `captureCharFrame()`, `mockInput`.

## Debug env vars

| Variable | Purpose |
|---|---|
| `OTUI_SHOW_STATS=true` | Show debug overlay (FPS, memory) at startup |
| `OTUI_DEBUG_FFI=true` | Debug FFI binding issues |
| `SHOW_CONSOLE=true` | Open built-in console overlay at startup |
| `OTUI_USE_CONSOLE=false` | Disable global `console.*` capture |

## Reference

OpenTUI docs are installed at `.agents/skills/opentui/docs/`. Key entry points:

- `docs/getting-started.mdx` — install, hello world, component basics
- `docs/core-concepts/renderer.mdx` — CliRenderer lifecycle, screen modes, events
- `docs/bindings/react.mdx` — React hooks, styling, JSX elements
- `docs/core-concepts/testing.mdx` — test renderer API
- `docs/reference/env-vars.mdx` — full env var reference
