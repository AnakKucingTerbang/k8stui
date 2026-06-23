import { t, fg } from "@opentui/core"

interface LogViewProps {
  lines: string[]
  scrollRef: React.RefObject<any>
  streaming: boolean
  previous: boolean
  wrap: boolean
}

const EMPTY_STATE_STREAMING = t`${fg("#8B949E")("Waiting for logs...")}`
const EMPTY_STATE_STOPPED = t`${fg("#8B949E")("Stream ended")}`
const EMPTY_STATE_NO_PREV = t`${fg("#8B949E")("No previous logs (container has not restarted)")}`

function getMaxLineWidth(lines: string[]): number {
  let max = 0
  for (const l of lines) {
    if (l.length > max) max = l.length
  }
  return max
}

export function LogView({ lines, scrollRef, streaming, previous, wrap }: LogViewProps) {
  if (lines.length === 0) {
    const msg = previous ? EMPTY_STATE_NO_PREV : (streaming ? EMPTY_STATE_STREAMING : EMPTY_STATE_STOPPED)
    return (
      <box style={{ flexDirection: "column", paddingLeft: 1, paddingRight: 1, flexGrow: 1, justifyContent: "center", alignItems: "center" }}>
        <text content={msg} />
      </box>
    )
  }

  if (wrap) {
    return (
      <scrollbox
        key="log-wrap"
        ref={scrollRef}
        scrollX={false}
        scrollY={true}
        stickyScroll={true}
        stickyStart="bottom"
        viewportCulling={true}
        style={{ width: "100%", height: "100%", paddingLeft: 1, paddingRight: 1 }}
      >
        {previous && (
          <box key="l-prev-header" style={{ height: 1, width: "100%", backgroundColor: "#1C2128" }}>
            <text content={t`${fg("#D29922")("── previous container ──")}`} />
          </box>
        )}
        {lines.map((line, i) => {
          const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s?(.*)$/)
          if (tsMatch) {
            const ts = tsMatch[1] || ""
            const body = tsMatch[2] || ""
            return (
              <text key={`l-${i}`} content={t`${fg("#8B949E")(ts)} ${fg("#E6EDF3")(body)}`} wrapMode="word" />
            )
          }
          return (
            <text key={`l-${i}`} content={t`${fg("#E6EDF3")(line)}`} wrapMode="word" />
          )
        })}
      </scrollbox>
    )
  }

  const header = previous ? "── previous container ──\n" : ""
  const allText = header + lines.join("\n")
  const maxW = getMaxLineWidth(lines)

  return (
    <scrollbox
      key="log-nowrap"
      ref={scrollRef}
      scrollX={true}
      scrollY={true}
      stickyScroll={true}
      stickyStart="bottom"
      viewportCulling={true}
      contentOptions={{ width: maxW + 4, minHeight: "100%" }}
      style={{ width: "100%", height: "100%", paddingLeft: 1, paddingRight: 1 }}
    >
      <text content={allText} wrapMode="none" fg="#E6EDF3" />
    </scrollbox>
  )
}
