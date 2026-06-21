import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App"

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
})

renderer.setBackgroundColor("#0D1117")

createRoot(renderer).render(<App renderer={renderer} />)
