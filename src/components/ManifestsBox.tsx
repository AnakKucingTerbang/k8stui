import { t, fg } from "@opentui/core"
import { Panel } from "./Panel"

export interface ManifestItem {
  label: string
  hasYaml: boolean
}

interface ManifestsBoxProps {
  items: ManifestItem[] | undefined
  selectedIndex: number
  focused: boolean
  spinner: string
}

export function ManifestsBox({ items, selectedIndex, focused, spinner }: ManifestsBoxProps) {
  if (items === undefined) {
    return (
      <Panel title="MANIFESTS" focused={focused}>
        <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
      </Panel>
    )
  }

  if (items.length === 0) {
    return (
      <Panel title="MANIFESTS" focused={focused}>
        <text fg="#8B949E" content="──" />
      </Panel>
    )
  }

  const showSeparator = items.length >= 2

  return (
    <Panel title="MANIFESTS" focused={focused}>
      {items.map((item, i) => {
        const isSelected = i === selectedIndex
        const bgColor = isSelected ? "#1A3A5C" : undefined
        const textColor = isSelected ? "#E6EDF3" : "#8B949E"

        return (
          <>
            {showSeparator && i === items.length - 1 && (
              <box key="sep" style={{ height: 1, width: "100%" }}>
                <text content={t`${fg("#484F58")(" ───────────────────────")}`} />
              </box>
            )}
            <box key={`m-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={t`${fg(textColor)(` ${item.label}`)}`} />
            </box>
          </>
        )
      })}
    </Panel>
  )
}
