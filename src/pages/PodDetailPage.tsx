import { useCallback, useMemo, useRef, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { CommandsBar } from "../components/CommandsBar"
import { PodSectionList, PodSectionDetail, buildSections, getDetailValue, getDetailRowCount } from "../components/PodDetailView"
import { Toast } from "../components/Toast"
import { copyToClipboard } from "../clipboard"
import type { PodDetail, PodDetailFull } from "../types"

type PodDetailMode = "sections" | "details"

interface PodDetailPageProps {
  pod: PodDetail
  podDetailFull: PodDetailFull | null
  loading: boolean
  spinner: string
  onBack: () => void
  onQuit: () => void
}

export function PodDetailPage({
  pod,
  podDetailFull,
  loading,
  spinner,
  onBack,
  onQuit,
}: PodDetailPageProps) {
  const [podSectionIndex, setPodSectionIndex] = useState(0)
  const [podDetailScrollOffset, setPodDetailScrollOffset] = useState(0)
  const [podDetailMode, setPodDetailMode] = useState<PodDetailMode>("sections")
  const [detailRowIndex, setDetailRowIndex] = useState(0)
  const [toastMessage, setToastMessage] = useState("")
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { height: termHeight } = useTerminalDimensions()
  const maxVisibleRows = Math.max(1, termHeight - 24)

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        if (podDetailMode === "details") {
          setPodDetailMode("sections")
        } else {
          onBack()
        }
      } else if (key.name === "tab") {
        if (podDetailMode === "sections") {
          setPodDetailMode("details")
          setDetailRowIndex(0)
          setPodDetailScrollOffset(0)
        } else {
          setPodDetailMode("sections")
        }
      } else if (key.name === "return") {
        if (podDetailMode === "details" && podDetailFull) {
          const value = getDetailValue(podDetailFull, podSectionIndex, detailRowIndex)
          if (value) {
            copyToClipboard(value)
            setToastMessage("value copied to clipboard")
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
          }
        }
      } else if (key.name === "up") {
        if (podDetailMode === "sections") {
          if (podSectionIndex > 0) {
            setPodSectionIndex((i: number) => i - 1)
            setPodDetailScrollOffset(0)
          }
        } else {
          if (detailRowIndex > 0) {
            setDetailRowIndex((i: number) => i - 1)
            if (detailRowIndex <= podDetailScrollOffset) {
              setPodDetailScrollOffset((i: number) => Math.max(0, i - 1))
            }
          }
        }
      } else if (key.name === "down") {
        if (podDetailMode === "sections") {
          if (podDetailFull) {
            const maxSections = buildSections(podDetailFull).length
            if (podSectionIndex < maxSections - 1) {
              setPodSectionIndex((i: number) => i + 1)
              setPodDetailScrollOffset(0)
            }
          }
        } else if (podDetailFull) {
          const maxRows = getDetailRowCount(podDetailFull, podSectionIndex)
          if (maxRows > 0 && detailRowIndex < maxRows - 1) {
            setDetailRowIndex((i: number) => i + 1)
            if (detailRowIndex >= podDetailScrollOffset + maxVisibleRows - 1) {
              setPodDetailScrollOffset((i: number) => i + 1)
            }
          }
        }
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [
      podDetailMode,
      podSectionIndex,
      detailRowIndex,
      podDetailScrollOffset,
      podDetailFull,
      maxVisibleRows,
      onBack,
      onQuit,
    ],
  )

  useKeyboard(handleKey)

  const commands = useMemo(() => {
    if (podDetailMode === "details") {
      return t`${fg("#58A6FF")("[enter]")} copy  ${fg("#58A6FF")("[tab]")} toggle focus  ${fg("#58A6FF")("[↑↓]")} scroll  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[q]")}uit`
    }
    return t`${fg("#58A6FF")("[tab]")} toggle focus  ${fg("#58A6FF")("[↑↓]")} nav  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[q]")}uit`
  }, [podDetailMode])

  return (
    <>
      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <box
          title="SECTIONS"
          borderStyle="single"
          borderColor={podDetailMode === "sections" ? "#58A6FF" : "#30363D"}
          style={{ flexDirection: "column", width: 28 }}
        >
          {loading ? (
            <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
              <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading pod detail...")}`} />
            </box>
          ) : podDetailFull ? (
            <PodSectionList pod={podDetailFull} selectedIndex={podSectionIndex} />
          ) : (
            <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
              <text fg="#F85149" content="Failed to load pod detail" />
            </box>
          )}
        </box>
        <box
          title="DETAILS"
          borderStyle="single"
          borderColor={podDetailMode === "details" ? "#58A6FF" : "#30363D"}
          style={{ flexDirection: "column", flexGrow: 1 }}
        >
          {podDetailFull ? (
            <PodSectionDetail
              pod={podDetailFull}
              sectionIndex={podSectionIndex}
              scrollOffset={podDetailScrollOffset}
              detailMode={podDetailMode === "details"}
              detailRowIndex={detailRowIndex}
            />
          ) : null}
        </box>
        <Toast message={toastMessage} />
      </box>

      <CommandsBar content={commands} />
    </>
  )
}

export type { PodDetailMode }
