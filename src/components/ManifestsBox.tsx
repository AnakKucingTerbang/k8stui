import { t, fg } from "@opentui/core"

export interface ManifestItem {
  label: string
  hasYaml: boolean
}

interface ManifestsBoxProps {
  items: ManifestItem[]
  selectedIndex: number
  focused: boolean
  loading?: boolean
  spinner?: string
}

export function ManifestsBox({ items, selectedIndex, focused, loading, spinner }: ManifestsBoxProps) {
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

  if (items.length === 0) {
    return (
      <box
        title="MANIFESTS"
        borderStyle="single"
        borderColor={focused ? "#58A6FF" : "#30363D"}
        style={{ flexDirection: "column", width: "100%" }}
      >
        <text fg="#8B949E" content="──" />
      </box>
    )
  }

  return (
    <box
      title="MANIFESTS"
      borderStyle="single"
      borderColor={focused ? "#58A6FF" : "#30363D"}
      style={{ flexDirection: "column", width: "100%" }}
    >
      {items.map((item, i) => {
        const isSelected = i === selectedIndex
        const bgColor = isSelected ? "#1A3A5C" : undefined
        const textColor = isSelected ? "#E6EDF3" : "#8B949E"

        return (
          <box key={`m-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
            <text content={t`${fg(textColor)(` ${item.label}`)}`} />
          </box>
        )
      })}
    </box>
  )
}
