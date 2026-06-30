import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import { Panel } from "../components/Panel"
import { Section } from "../components/Section"
import { DetailsPanel, getSelectedRowDisplay } from "../components/DetailsPanel"
import { YamlView } from "../components/YamlView"
import { CommandsBar, type CommandItem } from "../components/CommandsBar"
import { Toast } from "../components/Toast"
import { copyToClipboard } from "../utils/clipboard"
import type { DetailRow, CustomResourceDetailData } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const DASH = "──"

type LeftView = "yaml" | "metadata"
type Focus = "left" | "right"

const LEFT_ITEMS: LeftView[] = ["yaml", "metadata"]
const LEFT_LABELS: Record<LeftView, string> = {
  yaml: "YAML",
  metadata: "Metadata",
}

interface CustomResourcePageProps {
  kind: string
  name: string
  namespace: string
  detail: CustomResourceDetailData | null
  loading: boolean
  onBack: () => void
  onQuit: () => void
}

export function CustomResourcePage({
  kind,
  name,
  namespace,
  detail,
  loading,
  onBack,
  onQuit,
}: CustomResourcePageProps) {
  const [focus, setFocus] = useState<Focus>("left")
  const [leftIndex, setLeftIndex] = useState(0)
  const [detailScrollOffset, setDetailScrollOffset] = useState(0)
  const [detailRowIndex, setDetailRowIndex] = useState(-1)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [toastMessage, setToastMessage] = useState("")
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const yamlScrollRef = useRef<any>(null)
  const yamlTextareaRef = useRef<any>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const { height: termHeight } = useTerminalDimensions()
  const maxVisibleRows = Math.max(1, termHeight - 24)

  const activeView = LEFT_ITEMS[leftIndex]!
  const isYamlView = activeView === "yaml"
  const detailsRows: DetailRow[] | undefined = isYamlView ? undefined : (detail?.summary || undefined)
  const detailsYaml: string | undefined = isYamlView ? (detail?.yaml || undefined) : undefined

  const toast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
  }, [])

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  useEffect(() => {
    setDetailScrollOffset(0)
    setDetailRowIndex(-1)
  }, [kind, name, namespace, leftIndex])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "up") {
        if (focus === "left") {
          if (leftIndex > 0) setLeftIndex((i) => i - 1)
        } else if (isYamlView) {
          yamlScrollRef.current?.scrollBy(-1)
        } else if (detailsRows) {
          if (detailRowIndex > 0) {
            setDetailRowIndex((i) => i - 1)
          } else if (detailRowIndex < 0 && detailsRows.length > 0) {
            setDetailRowIndex(0)
          }
          const newRow = detailRowIndex > 0 ? detailRowIndex - 1 : 0
          if (newRow < detailScrollOffset) setDetailScrollOffset(newRow)
        }
      } else if (key.name === "down") {
        if (focus === "left") {
          if (leftIndex < LEFT_ITEMS.length - 1) setLeftIndex((i) => i + 1)
        } else if (isYamlView) {
          yamlScrollRef.current?.scrollBy(1)
        } else if (detailsRows) {
          const maxIdx = detailsRows.length - 1
          if (detailRowIndex < maxIdx) setDetailRowIndex((i) => Math.min(maxIdx, i + 1))
          const newRow = Math.min(maxIdx, detailRowIndex + 1)
          if (newRow >= detailScrollOffset + maxVisibleRows) setDetailScrollOffset(newRow - maxVisibleRows + 1)
        }
      } else if (key.name === "right") {
        if (focus === "left") setFocus("right")
        else if (isYamlView) yamlScrollRef.current?.scrollBy({ x: 5, y: 0 })
      } else if (key.name === "left") {
        if (focus === "right") setFocus("left")
        else if (isYamlView) yamlScrollRef.current?.scrollBy({ x: -5, y: 0 })
      } else if (key.name === "return") {
        if (focus === "left") {
          setFocus("right")
        } else if (focus === "right" && detailsRows && detailRowIndex >= 0) {
          const row = detailsRows[detailRowIndex]
          if (row && !row.isParent && row.value) {
            copyToClipboard(row.value)
            toast("value copied to clipboard")
          }
        }
      } else if (key.name === "pageup") {
        if (focus === "right") {
          if (isYamlView) {
            yamlScrollRef.current?.scrollBy(-maxVisibleRows)
          } else if (detailsRows) {
            setDetailScrollOffset((i) => Math.max(0, i - maxVisibleRows))
          }
        }
      } else if (key.name === "pagedown") {
        if (focus === "right") {
          if (isYamlView) {
            yamlScrollRef.current?.scrollBy(maxVisibleRows)
          } else if (detailsRows) {
            const maxOff = Math.max(0, detailsRows.length - maxVisibleRows)
            setDetailScrollOffset((i) => Math.min(maxOff, i + maxVisibleRows))
          }
        }
      } else if (key.name === "home") {
        if (focus === "right") {
          if (isYamlView) {
            yamlScrollRef.current?.scrollTo(0)
          } else {
            setDetailScrollOffset(0)
            setDetailRowIndex(0)
          }
        }
      } else if (key.name === "end") {
        if (focus === "right") {
          if (isYamlView) {
            yamlScrollRef.current?.scrollTo(yamlScrollRef.current?.scrollHeight ?? 0)
          } else if (detailsRows) {
            setDetailScrollOffset(Math.max(0, detailsRows.length - maxVisibleRows))
            setDetailRowIndex(detailsRows.length - 1)
          }
        }
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [focus, leftIndex, isYamlView, detailsRows, detailScrollOffset, detailRowIndex, maxVisibleRows, onBack, onQuit, toast],
  )

  useKeyboard(handleKey)

  const selectedDisplay = useMemo(() => {
    if (isYamlView) return DASH
    if (detailsRows && detailRowIndex >= 0) {
      const display = getSelectedRowDisplay(detailsRows, detailRowIndex)
      if (display.includes("=")) {
        const eqIdx = display.indexOf(" = ")
        const keyPart = display.slice(0, eqIdx)
        const value = display.slice(eqIdx + 3)
        return t`${fg("#8B949E")(keyPart)} ${fg("#484F58")("=")} ${fg("#E6EDF3")(value)}`
      }
      return t`${bold(fg("#58A6FF")(display))}`
    }
    return DASH
  }, [isYamlView, detailsRows, detailRowIndex])

  const rightTitle = useMemo(() => {
    if (isYamlView) return "YAML"
    return "METADATA"
  }, [isYamlView])

  const commands = useMemo<CommandItem[]>(() => {
    if (focus === "left") {
      return [
        { key: "[↑↓]", label: "nav" },
        { key: "[→]", label: "details" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    if (isYamlView) {
      return [
        { key: "[↑↓←→]", label: "scroll" },
        { key: "[pgup/pgdn]", label: "page" },
        { key: "[home/end]", label: "top/bottom" },
        { key: "[←]", label: "focus left" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    return [
      { key: "[↑↓]", label: "scroll" },
      { key: "[enter]", label: "copy" },
      { key: "[pgup/pgdn]", label: "page" },
      { key: "[home/end]", label: "top/bottom" },
      { key: "[←]", label: "focus left" },
      { key: "[esc]", label: "back" },
      { key: "[q]", label: "uit" },
    ]
  }, [focus, isYamlView])

  return (
    <>
      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <box style={{ flexDirection: "column", width: 18, gap: 0 }}>
          <Panel title="VIEWS" focused={focus === "left"} width={18} gap={0}>
            {LEFT_ITEMS.map((view, i) => {
              const isSelected = i === leftIndex
              const bgColor = isSelected ? "#1A3A5C" : undefined
              const textColor = isSelected ? "#E6EDF3" : "#8B949E"
              const label = LEFT_LABELS[view]
              return (
                <box key={view} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                  <text content={t`${fg(textColor)(` ${label}`)}`} />
                </box>
              )
            })}
          </Panel>
        </box>

        <box style={{ flexDirection: "column", flexGrow: 1, gap: 0 }}>
          <Panel title={rightTitle} borderColor={focus === "right" ? "#58A6FF" : "#30363D"} flexGrow={1}>
            <DetailsPanel
              rows={detailsRows}
              yaml={detailsYaml}
              yamlMode="view"
              editEnabled={false}
              scrollOffset={detailScrollOffset}
              detailRowIndex={detailRowIndex}
              scrollRef={yamlScrollRef}
              textareaRef={yamlTextareaRef}
              spinner={spinner}
            />
          </Panel>
          <Section title="SELECTED" height={3}>
            <text content={typeof selectedDisplay === "string" ? selectedDisplay : selectedDisplay} />
          </Section>
        </box>

        <Toast message={toastMessage} />
      </box>

      <CommandsBar commands={commands} />
    </>
  )
}
