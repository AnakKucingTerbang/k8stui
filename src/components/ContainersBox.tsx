import { t, fg } from "@opentui/core"
import type { PodContainer } from "../types"

interface ContainersBoxProps {
  containers: PodContainer[]
  selectedIndex: number
  focused: boolean
  loading?: boolean
  spinner?: string
}

export function ContainersBox({ containers, selectedIndex, focused, loading, spinner }: ContainersBoxProps) {
  if (loading) {
    return (
      <box
        title="CONTAINERS"
        borderStyle="single"
        borderColor={focused ? "#58A6FF" : "#30363D"}
        style={{ flexDirection: "column", width: "100%" }}
      >
        <text content={t`${fg("#D29922")(spinner || "⠋")} ${fg("#8B949E")("Loading...")}`} />
      </box>
    )
  }

  return (
    <box
      title="CONTAINERS"
      borderStyle="single"
      borderColor={focused ? "#58A6FF" : "#30363D"}
      style={{ flexDirection: "column", width: "100%" }}
    >
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
    </box>
  )
}
