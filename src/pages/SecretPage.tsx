import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { PodTable } from "../components/PodTable"
import { CommandsBar } from "../components/CommandsBar"
import { Toast } from "../components/Toast"
import { copyToClipboard } from "../utils/clipboard"
import type { PodDetail, DetailRow } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const DASH = "──"
const SEP = "  "
const MASK = "******"

type LeftView = "summary" | "keys" | "refs"
type Focus = "left" | "right"

const LEFT_VIEWS: LeftView[] = ["summary", "keys", "refs"]

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function val(s: string): string {
  return s || DASH
}

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

interface SecretPageProps {
  name: string
  namespace: string
  summary: DetailRow[]
  dataKeys: string[]
  rawData: Record<string, string>
  pods: PodDetail[]
  loading: boolean
  onOpenPod: (pod: PodDetail) => void
  onBack: () => void
  onQuit: () => void
}

export function SecretPage({
  name,
  namespace,
  summary,
  dataKeys,
  rawData,
  pods,
  loading,
  onOpenPod,
  onBack,
  onQuit,
}: SecretPageProps) {
  const [leftIndex, setLeftIndex] = useState(1)
  const [focus, setFocus] = useState<Focus>("left")
  const [revealed, setRevealed] = useState(false)
  const [decodedValues, setDecodedValues] = useState<Record<string, string> | null>(null)
  const [keyIndex, setKeyIndex] = useState(0)
  const [podIndex, setPodIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [toastMessage, setToastMessage] = useState("")
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rightScrollRef = useRef<any>(null)
  const podScrollRef = useRef<any>(null)

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  useEffect(() => {
    setLeftIndex(1)
    setFocus("left")
    setRevealed(false)
    setDecodedValues(null)
    setKeyIndex(0)
    setPodIndex(0)
  }, [name, namespace])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const activeView = LEFT_VIEWS[leftIndex]!

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "up") {
        if (focus === "left") {
          if (leftIndex > 0) setLeftIndex((i) => i - 1)
        } else if (focus === "right" && activeView === "keys") {
          if (keyIndex > 0) {
            const newIdx = keyIndex - 1
            setKeyIndex(newIdx)
            if (revealed) {
              scrollIntoView(rightScrollRef, `key-${newIdx}`)
            } else {
              scrollIntoView(rightScrollRef, `key-${newIdx}`)
            }
          }
        } else if (focus === "right" && activeView === "refs") {
          if (podIndex > 0) {
            const newIdx = podIndex - 1
            setPodIndex(newIdx)
            scrollIntoView(podScrollRef, `pod-${newIdx}`)
          }
        } else if (focus === "right" && activeView === "summary") {
          rightScrollRef.current?.scrollBy(-1)
        }
      } else if (key.name === "down") {
        if (focus === "left") {
          if (leftIndex < LEFT_VIEWS.length - 1) setLeftIndex((i) => i + 1)
        } else if (focus === "right" && activeView === "keys") {
          if (keyIndex < dataKeys.length - 1) {
            const newIdx = keyIndex + 1
            setKeyIndex(newIdx)
            if (revealed) {
              scrollIntoView(rightScrollRef, `keyval-${newIdx}`)
            } else {
              scrollIntoView(rightScrollRef, `key-${newIdx}`)
            }
          }
        } else if (focus === "right" && activeView === "refs") {
          if (podIndex < pods.length - 1) {
            const newIdx = podIndex + 1
            setPodIndex(newIdx)
            scrollIntoView(podScrollRef, `pod-${newIdx}`)
          }
        } else if (focus === "right" && activeView === "summary") {
          rightScrollRef.current?.scrollBy(1)
        }
      } else if (key.name === "right") {
        if (focus === "left") {
          setFocus("right")
          if (activeView === "keys") setKeyIndex(0)
        }
      } else if (key.name === "left") {
        if (focus === "right") {
          setFocus("left")
        }
      } else if (key.name === "return") {
        if (focus === "right" && activeView === "keys") {
          const selectedKey = dataKeys[keyIndex]
          if (selectedKey) {
            const valueToCopy = decodedValues?.[selectedKey] ?? ""
            copyToClipboard(valueToCopy)
            setToastMessage(`copied ${selectedKey}`)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
          }
        } else if (focus === "right" && activeView === "refs") {
          const pod = pods[podIndex]
          if (pod) onOpenPod(pod)
        }
      } else if (key.name === "d") {
        if (focus === "right" && activeView === "keys") {
          if (!decodedValues) {
            const decoded: Record<string, string> = {}
            for (const k of dataKeys) {
              const raw = rawData[k]
              if (raw) {
                const d = decodeBase64(raw)
                decoded[k] = isBinary(d) ? "<binary>" : d
              } else {
                decoded[k] = ""
              }
            }
            setDecodedValues(decoded)
          }
          setRevealed((v) => !v)
        }
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [focus, leftIndex, activeView, keyIndex, podIndex, pods, dataKeys, rawData, decodedValues, onOpenPod, onBack, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const leftBorderColor = focus === "left" ? "#58A6FF" : "#30363D"
  const rightBorderColor = focus === "right" ? "#58A6FF" : "#30363D"

  const rightTitle = useMemo(() => {
    if (activeView === "summary") return "SUMMARY"
    if (activeView === "keys") {
      const count = dataKeys.length
      if (revealed) return `KEYS (${count}, revealed)`
      return `KEYS (${count})`
    }
    return "REFS"
  }, [activeView, revealed, dataKeys.length])

  const commands = useMemo(() => {
    if (focus === "right" && activeView === "keys") {
      const toggleLabel = revealed ? "mask" : "reveal"
      return t`${fg("#58A6FF")("[d]")} ${fg("#8B949E")(toggleLabel + "  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("copy  ")}${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
    }
    if (focus === "right" && activeView === "refs" && pods.length > 0) {
      return t`${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("pod  ")}${fg("#58A6FF")("[←→]")} ${fg("#8B949E")("focus  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
    }
    if (focus === "right" && activeView === "refs") {
      return t`${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
    }
    if (focus === "right" && activeView === "summary") {
      return t`${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("scroll  ")}${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
    }
    return t`${fg("#58A6FF")("[→]")} ${fg("#8B949E")("details  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
  }, [focus, activeView, revealed, pods.length])

  const renderRightContent = () => {
    if (loading) {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
        </box>
      )
    }

    if (activeView === "summary") {
      return (
        <box style={{ flexDirection: "column", width: "100%", flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}>
          <scrollbox ref={rightScrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
            {summary.map((row, i) => {
              const keyColor = row.indent ? "#8B949E" : "#58A6FF"
              const displayKey = row.indent ? pad(row.key, 16) : pad(row.key, 18)
              const prefix = row.indent ? "  " : ""
              if (row.isParent) {
                return (
                  <box key={i} style={{ height: 1, width: "100%" }}>
                    <text content={t`${fg("#E6EDF3")(pad(row.key, 18))}`} />
                  </box>
                )
              }
              return (
                <box key={i} style={{ height: 1, width: "100%" }}>
                  <text content={t`${prefix}${fg(keyColor)(displayKey)}${SEP}${fg("#8B949E")(val(row.value))}`} />
                </box>
              )
            })}
          </scrollbox>
        </box>
      )
    }

    if (activeView === "keys") {
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
            <scrollbox ref={rightScrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
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
          <scrollbox ref={rightScrollRef} scrollY={true} viewportCulling={true} style={{ width: "100%", flexGrow: 1 }} contentOptions={{ minHeight: "100%" }}>
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

    if (activeView === "refs") {
      if (pods.length === 0) {
        return (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text fg="#8B949E" content="No pods reference this secret" />
          </box>
        )
      }
      return <PodTable pods={pods} selectedIndex={podIndex} scrollRef={podScrollRef} />
    }

    return null
  }

  return (
    <>
      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <box
          title="VIEWS"
          borderStyle="single"
          borderColor={leftBorderColor}
          style={{ flexDirection: "column", width: 20, gap: 0 }}
        >
          <box style={{ flexDirection: "column", paddingLeft: 1, paddingTop: 1, gap: 0 }}>
            {LEFT_VIEWS.map((view, i) => {
              const isSelected = i === leftIndex
              const bgColor = isSelected ? "#1A3A5C" : undefined
              const textColor = isSelected ? "#E6EDF3" : "#8B949E"
              const label = view.charAt(0).toUpperCase() + view.slice(1)
              return (
                <box key={view} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                  <text content={t`${fg(textColor)(label)}`} />
                </box>
              )
            })}
          </box>
        </box>

        <box
          title={rightTitle}
          borderStyle="single"
          borderColor={rightBorderColor}
          style={{ flexDirection: "column", flexGrow: 1, gap: 0 }}
        >
          {renderRightContent()}
        </box>
      </box>

      <CommandsBar content={commands} />
      <Toast message={toastMessage} />
    </>
  )
}
