import { t, fg } from "@opentui/core"

interface LogsBoxProps {
  containerName: string
  focused: boolean
  streaming: boolean
  sinceLabel: string
  previous: boolean
  wrap: boolean
  spinner: string
}

export function LogsBox({ containerName, focused, streaming, sinceLabel, previous, wrap }: LogsBoxProps) {
  const borderColor = focused ? "#58A6FF" : "#30363D"

  const dot = streaming ? fg("#3FB950")("●") : fg("#F85149")("○")
  const streamLabel = streaming ? "streaming" : "stopped"
  const wrapTag = wrap ? fg("#3FB950")("↩") : fg("#8B949E")("↔")
  const wrapLabel = wrap ? "wrap" : "nowrap"
  const prevTag = previous ? fg("#D29922")("‹prev›") : ""

  return (
    <box
      title="LOGS"
      borderStyle="single"
      borderColor={borderColor}
      style={{ flexDirection: "column", width: "100%" }}
    >
      <box style={{ height: 1, width: "100%" }}>
        <text content={t`${fg("#E6EDF3")("▸ ")}${fg("#58A6FF")(containerName || "──")}`} />
      </box>
      <box style={{ height: 1, width: "100%" }}>
        <text content={t`${dot} ${fg("#8B949E")(streamLabel)}  ${wrapTag} ${fg("#8B949E")(wrapLabel)}  ${fg("#8B949E")(sinceLabel)}${prevTag ? " " : ""}${prevTag}`} />
      </box>
    </box>
  )
}
