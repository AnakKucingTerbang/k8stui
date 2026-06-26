import { t, fg } from "@opentui/core"
import { Panel } from "./Panel"
import type { PodContainer } from "../types"

interface ContainersBoxProps {
  containers: PodContainer[]
  selectedIndex: number
  focused: boolean
  spinner: string
}

export function ContainersBox({ containers, selectedIndex, focused, spinner }: ContainersBoxProps) {
  if (containers.length === 0) {
    return (
      <Panel title="CONTAINERS" focused={focused}>
        <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
      </Panel>
    )
  }

  return (
    <Panel title="CONTAINERS" focused={focused}>
      {containers.map((c, i) => {
        const isSelected = i === selectedIndex
        const bgColor = isSelected ? "#1A3A5C" : undefined
        const textColor = isSelected ? "#E6EDF3" : "#8B949E"
        const indicator = isSelected ? "▸ " : "  "

        return (
          <box key={`c-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(textColor)(`${indicator}${c.name}`)}`} />
          </box>
        )
      })}
    </Panel>
  )
}
