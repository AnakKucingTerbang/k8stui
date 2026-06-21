import { t, fg } from "@opentui/core"
import type { KubeContext } from "../types"

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length)
}

interface ContextModalProps {
  contexts: KubeContext[]
  currentContext: string
  filteredContexts: KubeContext[]
  selectIndex: number
  search: string
  searchCursor: number
  termWidth: number
  termHeight: number
}

export function ContextModal({
  contexts,
  currentContext,
  filteredContexts,
  selectIndex,
  search,
  searchCursor,
  termWidth,
  termHeight,
}: ContextModalProps) {
  const modalWidth = 52
  const modalHeight = 10
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  const maxVisible = 5
  const ctxScrollOffset = Math.max(0, Math.min(selectIndex, filteredContexts.length - maxVisible))
  const visibleContexts = filteredContexts.slice(ctxScrollOffset, ctxScrollOffset + maxVisible)

  const searchBeforeCursor = search.slice(0, searchCursor)
  const searchAtCursor = search.slice(searchCursor, searchCursor + 1)
  const searchAfterCursor = search.slice(searchCursor + 1)
  const searchDisplay = t`${fg("#58A6FF")("filter: ")}${fg("#E6EDF3")(searchBeforeCursor)}${fg("#58A6FF")(searchAtCursor || "█")}${fg("#E6EDF3")(searchAfterCursor)}`

  return (
    <box
      title="SWITCH CONTEXT"
      borderStyle="single"
      borderColor="#58A6FF"
      style={{
        position: "absolute",
        top: modalTop,
        left: modalLeft,
        width: modalWidth,
        height: modalHeight,
        flexDirection: "column",
        zIndex: 100,
        backgroundColor: "#0D1117",
        paddingLeft: 1,
        paddingTop: 1,
      }}
    >
      <box style={{ height: 1, width: "100%" }}>
        <text content={searchDisplay} />
      </box>
      <box style={{ height: 1, width: "100%" }}>
        <text fg="#30363D" content={pad("", modalWidth - 4).replace(/ /g, "─")} />
      </box>
      {filteredContexts.length === 0 ? (
        <box style={{ height: 1, width: "100%" }}>
          <text fg="#484F58" content="No matching contexts" />
        </box>
      ) : (
        visibleContexts.map((ctx, vi) => {
          const realIndex = ctxScrollOffset + vi
          const isSelected = realIndex === selectIndex
          const isCurrent = ctx.name === currentContext
          const bgColor = isSelected ? "#1A3A5C" : undefined
          const textColor = isSelected ? "#E6EDF3" : "#8B949E"
          const prefix = isCurrent ? fg("#3FB950")("● ") : "  "
          const server = ctx.server.replace(/^https?:\/\//, "").substring(0, 24)

          return (
            <box key={ctx.name} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
              <text fg={textColor} content={t`${prefix}${pad(ctx.name, 20)}${fg("#484F58")(server)}`} />
            </box>
          )
        })
      )}
      {Array.from({ length: maxVisible - (filteredContexts.length === 0 ? 1 : visibleContexts.length) }, (_, i) => (
        <box key={`empty-${i}`} style={{ height: 1, width: "100%" }}>
          <text content="" />
        </box>
      ))}
      <box style={{ height: 1, width: "100%" }}>
        <text fg="#58A6FF" content={`${filteredContexts.length} of ${contexts.length} contexts`} />
      </box>
    </box>
  )
}
