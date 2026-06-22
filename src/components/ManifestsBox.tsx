import { t, fg } from "@opentui/core"

interface ManifestsBoxProps {
  hasOriginal: boolean
  selectedIndex: number
  focused: boolean
  loading?: boolean
  spinner?: string
}

export function ManifestsBox({ hasOriginal, selectedIndex, focused, loading, spinner }: ManifestsBoxProps) {
  if (loading) {
    return (
      <box
        title="MANIFESTS"
        borderStyle="single"
        borderColor={focused ? "#58A6FF" : "#30363D"}
        style={{ flexDirection: "column", width: "100%" }}
      >
        <text content={t`${fg("#D29922")(spinner || "⠋")} ${fg("#8B949E")("Loading...")}`} />
      </box>
    )
  }

  const items: string[] = []
  if (hasOriginal) items.push("Original Manifest")
  items.push("Live Manifest")

  return (
    <box
      title="MANIFESTS"
      borderStyle="single"
      borderColor={focused ? "#58A6FF" : "#30363D"}
      style={{ flexDirection: "column", width: "100%" }}
    >
      {items.map((label, i) => {
        const isSelected = i === selectedIndex
        const bgColor = isSelected ? "#1A3A5C" : undefined
        const textColor = isSelected ? "#E6EDF3" : "#8B949E"

        return (
          <box key={`m-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(textColor)(` ${label}`)}`} />
          </box>
        )
      })}
    </box>
  )
}
