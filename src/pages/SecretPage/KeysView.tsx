import { t, fg } from "@opentui/core"
import type { Focus } from "./types"

const MASK = "******"

function isBinary(decoded: string): boolean {
  return decoded.includes("\uFFFD")
}

function decodeBase64(raw: string): string {
  try {
    return Buffer.from(raw, "base64").toString("utf8")
  } catch {
    return "<binary>"
  }
}

interface KeysViewProps {
  dataKeys: string[]
  rawData: Record<string, string>
  revealed: boolean
  decodedValues: Record<string, string> | null
  keyIndex: number
  focus: Focus
  scrollRef: React.RefObject<any>
}

export function KeysView({
  dataKeys,
  rawData,
  revealed,
  decodedValues,
  keyIndex,
  focus,
  scrollRef,
}: KeysViewProps) {
  if (dataKeys.length === 0) {
    return (
      <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
        <text fg="#8B949E" content="No data keys" />
      </box>
    )
  }

  if (!revealed) {
    return (
      <box style={{ flexDirection: "column", width: "100%", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
        <scrollbox ref={scrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
          {dataKeys.map((key, i) => {
            const isSelected = focus === "right" && i === keyIndex
            const bgColor = isSelected ? "#1A3A5C" : undefined
            const valColor = isSelected ? "#E6EDF3" : "#8B949E"
            return (
              <box key={key} id={`key-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                <text content={t`${fg("#58A6FF")(key)}${fg(valColor)("=")}${fg(valColor)(MASK)}`} />
              </box>
            )
          })}
        </scrollbox>
      </box>
    )
  }

  return (
    <box style={{ flexDirection: "column", width: "100%", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
      <scrollbox ref={scrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
        {dataKeys.flatMap((key, i) => {
          const isSelected = focus === "right" && i === keyIndex
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const value = decodedValues?.[key] ?? ""
          return [
            <box key={`${key}-k`} id={`key-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={t`${fg("#58A6FF")(key)}`} />
            </box>,
            <box key={`${key}-v`} id={`keyval-${i}`} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text content={t`${fg("#E6EDF3")(value)}`} />
            </box>,
          ]
        })}
      </scrollbox>
    </box>
  )
}

export { isBinary, decodeBase64 }
