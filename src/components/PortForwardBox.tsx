import { t, fg } from "@opentui/core"
import { Panel } from "./Panel"
import type { PortForwardEntry } from "../types"

interface PortForwardBoxProps {
  forwards: PortForwardEntry[]
  focused: boolean
}

export function PortForwardBox({ forwards, focused }: PortForwardBoxProps) {
  const count = forwards.length
  if (count === 0) {
    return (
      <Panel title="PORT-FWD" focused={focused}>
        <text content={t`${fg("#8B949E")("  [enter] on Ports")}`} />
      </Panel>
    )
  }

  return (
    <Panel title={`PORT-FWD (${count})`} focused={focused}>
      {forwards.map((f, i) => (
        <box key={`pf-${i}`} style={{ height: 1, width: "100%" }}>
          <text content={t`${fg("#3FB950")("●")} ${fg("#E6EDF3")(`${f.localPort}`)}${fg("#484F58")(":")}${fg("#8B949E")(`${f.containerPort}/${f.protocol.toLowerCase()}`)}`} />
        </box>
      ))}
    </Panel>
  )
}
