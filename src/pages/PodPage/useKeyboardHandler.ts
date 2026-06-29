import { useCallback } from "react"
import { copyToClipboard } from "../../utils/clipboard"
import type { PodDetailFull, DetailRow } from "../../types"
import type { FocusTarget, LeftBox, YamlEditMode } from "./types"

type SetStateNum = React.Dispatch<React.SetStateAction<number>>
type SetStateBool = React.Dispatch<React.SetStateAction<boolean>>

interface UseKeyboardHandlerArgs {
  focus: FocusTarget
  setFocus: (f: FocusTarget) => void
  lastLeftBox: LeftBox
  setLastLeftBox: (b: LeftBox) => void
  containerIndex: number
  setContainerIndex: SetStateNum
  appResourceIndex: number
  setAppResourceIndex: SetStateNum
  manifestIndex: number
  setManifestIndex: SetStateNum
  detailScrollOffset: number
  setDetailScrollOffset: SetStateNum
  detailRowIndex: number
  setDetailRowIndex: SetStateNum
  maxVisibleRows: number
  isYamlDetails: boolean
  isLogsView: boolean
  logsWrap: boolean
  logsPrevious: boolean
  setLogsWrap: SetStateBool
  setLogsPrevious: SetStateBool
  setLogsSinceKey: (k: string) => void
  yamlEditMode: YamlEditMode
  canEdit: boolean
  activeYaml: string
  detailsRows: DetailRow[] | undefined
  podDetailFull: PodDetailFull | null
  manifestItems: { length: number } | undefined
  logsScrollRef: React.RefObject<any>
  yamlScrollRef: React.RefObject<any>
  onBack: () => void
  onQuit: () => void
  onEdit: () => void
  onToast: (msg: string) => void
  onOpenPortForward: () => void
  showPortForwardModal: boolean
}

function isPortsRow(rows: DetailRow[], idx: number): boolean {
  const row = rows[idx]
  if (!row) return false
  if (row.key === "Ports" && row.isParent) return true
  if (row.key === "Port Forwards" && row.isParent) return true
  if (row.indent && idx > 0) {
    const prev = rows[idx - 1]
    if ((prev?.key === "Ports" && prev.isParent) || (prev?.key === "Port Forwards" && prev.isParent)) return true
  }
  return false
}

export function useKeyboardHandler({
  focus,
  setFocus,
  lastLeftBox,
  setLastLeftBox,
  containerIndex,
  setContainerIndex,
  appResourceIndex,
  setAppResourceIndex,
  manifestIndex,
  setManifestIndex,
  detailScrollOffset,
  setDetailScrollOffset,
  detailRowIndex,
  setDetailRowIndex,
  maxVisibleRows,
  isYamlDetails,
  isLogsView,
  logsWrap,
  setLogsWrap,
  setLogsPrevious,
  setLogsSinceKey,
  yamlEditMode,
  canEdit,
  detailsRows,
  podDetailFull,
  manifestItems,
  logsScrollRef,
  yamlScrollRef,
  onBack,
  onQuit,
  onEdit,
  onToast,
  onOpenPortForward,
  showPortForwardModal,
}: UseKeyboardHandlerArgs) {
  const LEFT_ORDER: LeftBox[] = ["containers", "application", "manifests", "logs", "portforward"]
  const currentLeftIndex = LEFT_ORDER.indexOf(focus as LeftBox)

  return useCallback(
    (key: { name: string; ctrl: boolean; shift: boolean }) => {
      if (yamlEditMode === "edit") return
      if (showPortForwardModal) return

      if (key.name === "escape") {
        onBack()
      } else if (key.name === "tab") {
        if (focus === "details") {
          setFocus(lastLeftBox)
        } else {
          const nextIdx = (currentLeftIndex + 1) % LEFT_ORDER.length
          const nextBox = LEFT_ORDER[nextIdx]!
          setFocus(nextBox)
          setLastLeftBox(nextBox)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        }
      } else if (key.name === "right") {
        if (focus !== "details") {
          setLastLeftBox(focus as LeftBox)
          setFocus("details")
          setDetailRowIndex(-1)
        } else if (isYamlDetails && yamlEditMode === "view") {
          yamlScrollRef.current?.scrollBy({ x: 5, y: 0 })
        }
      } else if (key.name === "left") {
        if (focus === "details") {
          setFocus(lastLeftBox)
        } else if (isYamlDetails && yamlEditMode === "view") {
          yamlScrollRef.current?.scrollBy({ x: -5, y: 0 })
        }
      } else if (key.name === "up") {
        if (focus === "details" && isLogsView) {
          logsScrollRef.current?.scrollBy(-1)
        } else if (focus === "details") {
          if (detailsRows && !isYamlDetails) {
            if (detailRowIndex > 0) {
              setDetailRowIndex((i) => i - 1)
            } else if (detailRowIndex < 0 && detailsRows.length > 0) {
              setDetailRowIndex(0)
            }
            const newRow = detailRowIndex > 0 ? detailRowIndex - 1 : 0
            if (newRow < detailScrollOffset) setDetailScrollOffset(newRow)
          } else if (isYamlDetails && yamlEditMode === "view") {
            yamlScrollRef.current?.scrollBy(-1)
          }
        } else if (focus === "containers") {
          if (containerIndex > 0) setContainerIndex((i) => i - 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "application") {
          if (appResourceIndex > 0) setAppResourceIndex((i) => i - 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "manifests") {
          if (manifestIndex > 0) setManifestIndex((i) => i - 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "logs") {
          if (containerIndex > 0) setContainerIndex((i) => i - 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "portforward") {
          if (containerIndex > 0) setContainerIndex((i) => i - 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        }
      } else if (key.name === "down") {
        if (focus === "details" && isLogsView) {
          logsScrollRef.current?.scrollBy(1)
        } else if (focus === "details") {
          if (detailsRows && !isYamlDetails) {
            const maxIdx = detailsRows.length - 1
            if (detailRowIndex < maxIdx) setDetailRowIndex((i) => Math.min(maxIdx, i + 1))
            const newRow = Math.min(maxIdx, detailRowIndex + 1)
            if (newRow >= detailScrollOffset + maxVisibleRows) setDetailScrollOffset(newRow - maxVisibleRows + 1)
          } else if (isYamlDetails && yamlEditMode === "view") {
            yamlScrollRef.current?.scrollBy(1)
          }
        } else if (focus === "containers") {
          const max = podDetailFull?.containers.length ?? 0
          if (containerIndex < max - 1) setContainerIndex((i) => i + 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "application") {
          const max = podDetailFull?.appResources?.length ?? 0
          if (appResourceIndex < max - 1) setAppResourceIndex((i) => i + 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "manifests") {
          const max = manifestItems?.length ?? 0
          if (manifestIndex < max - 1) setManifestIndex((i) => i + 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "logs") {
          const max = podDetailFull?.containers.length ?? 0
          if (containerIndex < max - 1) setContainerIndex((i) => i + 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "portforward") {
          const max = podDetailFull?.containers.length ?? 0
          if (containerIndex < max - 1) setContainerIndex((i) => i + 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        }
      } else if (key.name === "return") {
        if (focus === "details" && detailsRows && detailRowIndex >= 0) {
          if (isPortsRow(detailsRows, detailRowIndex)) {
            onOpenPortForward()
          } else {
            const row = detailsRows[detailRowIndex]
            if (row && !row.isParent && row.value) {
              copyToClipboard(row.value)
              onToast("value copied to clipboard")
            }
          }
        } else if (focus === "portforward") {
          onOpenPortForward()
        }
      } else if (key.name === "e") {
        if (canEdit) onEdit()
      } else if (key.name === "w") {
        if (isLogsView) setLogsWrap((v) => !v)
      } else if (key.name === "p") {
        if (isLogsView) setLogsPrevious((v) => !v)
      } else if (key.name === "[") {
        if (focus === "details" && isLogsView && !logsWrap) {
          logsScrollRef.current?.scrollBy({ x: -5, y: 0 })
        }
      } else if (key.name === "]") {
        if (focus === "details" && isLogsView && !logsWrap) {
          logsScrollRef.current?.scrollBy({ x: 5, y: 0 })
        }
      } else if (key.name === "0") {
        if (isLogsView) setLogsSinceKey("0")
      } else if (key.name === "1") {
        if (isLogsView) setLogsSinceKey("1")
      } else if (key.name === "2") {
        if (isLogsView) setLogsSinceKey("2")
      } else if (key.name === "3") {
        if (isLogsView) setLogsSinceKey("3")
      } else if (key.name === "pageup") {
        if (focus === "details" && isLogsView) {
          logsScrollRef.current?.scrollBy(-maxVisibleRows)
        } else if (focus === "details") {
          if (isYamlDetails && yamlEditMode === "view") yamlScrollRef.current?.scrollBy(-maxVisibleRows)
          else if (detailsRows && !isYamlDetails) setDetailScrollOffset((i) => Math.max(0, i - maxVisibleRows))
        }
      } else if (key.name === "pagedown") {
        if (focus === "details" && isLogsView) {
          logsScrollRef.current?.scrollBy(maxVisibleRows)
        } else if (focus === "details") {
          if (isYamlDetails && yamlEditMode === "view") yamlScrollRef.current?.scrollBy(maxVisibleRows)
          else if (detailsRows && !isYamlDetails) {
            const maxOff = Math.max(0, detailsRows.length - maxVisibleRows)
            setDetailScrollOffset((i) => Math.min(maxOff, i + maxVisibleRows))
          }
        }
      } else if (key.name === "home") {
        if (focus === "details" && isLogsView) {
          logsScrollRef.current?.scrollTo(0)
        } else if (focus === "details") {
          if (isYamlDetails && yamlEditMode === "view") yamlScrollRef.current?.scrollTo(0)
          else { setDetailScrollOffset(0); setDetailRowIndex(0) }
        }
      } else if (key.name === "end") {
        if (focus === "details" && isLogsView) {
          logsScrollRef.current?.scrollTo(logsScrollRef.current?.scrollHeight ?? 0)
        } else if (focus === "details") {
          if (isYamlDetails && yamlEditMode === "view") {
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
    [
      focus, lastLeftBox, containerIndex, appResourceIndex, manifestIndex,
      podDetailFull, manifestItems?.length, detailsRows, detailRowIndex,
      isYamlDetails, isLogsView, logsWrap, yamlEditMode, canEdit, maxVisibleRows,
      detailScrollOffset, onBack, onQuit, onEdit, onToast, onOpenPortForward,
      showPortForwardModal,
      setFocus, setLastLeftBox, setContainerIndex, setAppResourceIndex,
      setManifestIndex, setDetailScrollOffset, setDetailRowIndex,
      setLogsWrap, setLogsPrevious, setLogsSinceKey,
      logsScrollRef, yamlScrollRef, currentLeftIndex,
    ],
  )
}
