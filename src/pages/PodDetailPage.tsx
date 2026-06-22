import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import { PodHeader } from "../components/PodHeader"
import { ContainersBox } from "../components/ContainersBox"
import { ApplicationBox } from "../components/ApplicationBox"
import { ManifestsBox } from "../components/ManifestsBox"
import { DetailsPanel, getSelectedRowDisplay } from "../components/DetailsPanel"
import { CommandsBar } from "../components/CommandsBar"
import { Toast } from "../components/Toast"
import { copyToClipboard } from "../clipboard"
import { applyYamlAsync } from "../kube"
import type { PodDetail, PodDetailFull, PodContainer, DetailRow } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type LeftBox = "containers" | "application" | "manifests"
type FocusTarget = LeftBox | "details"
type YamlEditMode = "view" | "edit"

const DASH = "──"
const KEY_WIDTH = 12
const SEP = "  "

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, Math.max(0, len - 3)) + "..."
  return s + " ".repeat(len - s.length)
}

function val(s: string): string {
  return s || DASH
}

function buildContainerRows(container: PodContainer): DetailRow[] {
  const rows: DetailRow[] = []
  rows.push({ key: "Image", value: val(container.image) })
  if (container.command.length > 0) rows.push({ key: "Command", value: container.command.join(" ") })
  if (container.args.length > 0) rows.push({ key: "Args", value: container.args.join(" ") })
  if (container.ports.length > 0) rows.push({ key: "Ports", value: container.ports.join(", ") })
  rows.push({ key: "CPU Request", value: val(container.cpuRequest) })
  rows.push({ key: "CPU Limit", value: val(container.cpuLimit) })
  rows.push({ key: "Mem Request", value: val(container.memRequest) })
  rows.push({ key: "Mem Limit", value: val(container.memLimit) })
  rows.push({ key: "Liveness", value: val(container.livenessProbe) })
  rows.push({ key: "Readiness", value: val(container.readinessProbe) })

  if (container.env.length === 0) {
    rows.push({ key: "Environment", value: DASH })
  } else {
    rows.push({ key: "Environment", value: "", isParent: true })
    for (const e of container.env) {
      rows.push({ key: e.name, value: e.value, indent: true })
    }
  }

  if (container.pvcRefNames.length > 0) {
    rows.push({ key: "Volume Claims", value: "", isParent: true })
    for (const n of container.pvcRefNames) {
      rows.push({ key: "PVC", value: n, indent: true })
    }
  }

  return rows
}

interface PodDetailPageProps {
  pod: PodDetail
  podDetailFull: PodDetailFull | null
  loading: boolean
  onBack: () => void
  onQuit: () => void
  onRefresh: () => void
  contextName: string
}

const LEFT_ORDER: LeftBox[] = ["containers", "application", "manifests"]

export function PodDetailPage({
  pod,
  podDetailFull,
  loading,
  onBack,
  onQuit,
  onRefresh,
  contextName,
}: PodDetailPageProps) {
  const [focus, setFocus] = useState<FocusTarget>("containers")
  const [lastLeftBox, setLastLeftBox] = useState<LeftBox>("containers")
  const [containerIndex, setContainerIndex] = useState(0)
  const [appResourceIndex, setAppResourceIndex] = useState(0)
  const [manifestIndex, setManifestIndex] = useState(0)
  const [detailScrollOffset, setDetailScrollOffset] = useState(0)
  const [detailRowIndex, setDetailRowIndex] = useState(-1)
  const [yamlEditMode, setYamlEditMode] = useState<YamlEditMode>("view")
  const [editedYaml, setEditedYaml] = useState("")
  const [toastMessage, setToastMessage] = useState("")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const yamlScrollRef = useRef<any>(null)
  const textareaRef = useRef<any>(null)
  const renderer = useRenderer()

  const localSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) {
        clearInterval(spinnerRef.current)
        spinnerRef.current = null
      }
      return
    }
    spinnerRef.current = setInterval(() => {
      setSpinnerFrame((f: number) => f + 1)
    }, 80)
    return () => {
      if (spinnerRef.current) {
        clearInterval(spinnerRef.current)
        spinnerRef.current = null
      }
    }
  }, [loading])

  const { height: termHeight } = useTerminalDimensions()
  const maxVisibleRows = Math.max(1, termHeight - 24)

  const hasOriginalManifest = !!(podDetailFull?.combinedOriginalYaml)
  const manifestItems: string[] = []
  if (hasOriginalManifest) manifestItems.push("original")
  manifestItems.push("live")

  const containerRefNames = useMemo(() => {
    if (!podDetailFull || podDetailFull.containers.length === 0) {
      return { pvcs: [] as string[], secrets: [] as string[], configMaps: [] as string[] }
    }
    const c = podDetailFull.containers[containerIndex]
    return c
      ? { pvcs: c.pvcRefNames, secrets: c.secretRefNames, configMaps: c.configMapRefNames }
      : { pvcs: [] as string[], secrets: [] as string[], configMaps: [] as string[] }
  }, [podDetailFull, containerIndex])

  const detailsRows = useMemo((): DetailRow[] | undefined => {
    if (!podDetailFull) return undefined
    if (lastLeftBox === "containers") {
      const c = podDetailFull.containers[containerIndex]
      return c ? buildContainerRows(c) : undefined
    }
    if (lastLeftBox === "application") {
      const r = podDetailFull.appResources[appResourceIndex]
      return r ? r.summaryRows : undefined
    }
    return undefined
  }, [podDetailFull, lastLeftBox, containerIndex, appResourceIndex])

  const detailsYaml = useMemo((): string | undefined => {
    if (lastLeftBox !== "manifests" || !podDetailFull) return undefined
    if (manifestIndex === 0 && hasOriginalManifest) return podDetailFull.combinedOriginalYaml
    if (manifestIndex === manifestItems.length - 1) return podDetailFull.yaml
    return undefined
  }, [podDetailFull, lastLeftBox, manifestIndex, hasOriginalManifest, manifestItems.length])

  const isYamlDetails = detailsYaml !== undefined
  const isOriginalYaml = lastLeftBox === "manifests" && manifestIndex === 0 && hasOriginalManifest
  const canEdit = isOriginalYaml && yamlEditMode === "view"

  const activeYaml = useMemo(() => {
    if (yamlEditMode === "edit") return editedYaml || detailsYaml || ""
    return detailsYaml || ""
  }, [yamlEditMode, editedYaml, detailsYaml])

  const leftBoxFocused = (box: LeftBox): boolean => focus === box

  const currentLeftIndex = LEFT_ORDER.indexOf(focus as LeftBox)

  const handleKey = useCallback(
    (key: { name: string; ctrl: boolean; shift: boolean }) => {
      if (yamlEditMode === "edit") return

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
        if (focus === "details") {
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
        }
      } else if (key.name === "down") {
        if (focus === "details") {
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
          const max = podDetailFull?.appResources.length ?? 0
          if (appResourceIndex < max - 1) setAppResourceIndex((i) => i + 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        } else if (focus === "manifests") {
          if (manifestIndex < manifestItems.length - 1) setManifestIndex((i) => i + 1)
          setDetailScrollOffset(0)
          setDetailRowIndex(-1)
        }
      } else if (key.name === "return") {
        if (focus === "details" && detailsRows && detailRowIndex >= 0) {
          const row = detailsRows[detailRowIndex]
          if (row && !row.isParent && row.value) {
            copyToClipboard(row.value)
            setToastMessage("value copied to clipboard")
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
          }
        }
      } else if (key.name === "e") {
        if (canEdit) {
          setYamlEditMode("edit")
          setEditedYaml(activeYaml)
        }
      } else if (key.name === "pageup") {
        if (focus === "details") {
          if (isYamlDetails && yamlEditMode === "view") yamlScrollRef.current?.scrollBy(-maxVisibleRows)
          else if (detailsRows && !isYamlDetails) setDetailScrollOffset((i) => Math.max(0, i - maxVisibleRows))
        }
      } else if (key.name === "pagedown") {
        if (focus === "details") {
          if (isYamlDetails && yamlEditMode === "view") yamlScrollRef.current?.scrollBy(maxVisibleRows)
          else if (detailsRows && !isYamlDetails) {
            const maxOff = Math.max(0, detailsRows.length - maxVisibleRows)
            setDetailScrollOffset((i) => Math.min(maxOff, i + maxVisibleRows))
          }
        }
      } else if (key.name === "home") {
        if (focus === "details") {
          if (isYamlDetails && yamlEditMode === "view") yamlScrollRef.current?.scrollTo(0)
          else { setDetailScrollOffset(0); setDetailRowIndex(0) }
        }
      } else if (key.name === "end") {
        if (focus === "details") {
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
      podDetailFull, manifestItems.length, detailsRows, detailRowIndex,
      isYamlDetails, yamlEditMode, canEdit, activeYaml, maxVisibleRows,
      detailScrollOffset, onBack, onQuit,
    ],
  )

  useKeyboard(handleKey)

  const handleApply = useCallback(async () => {
    const yamlToApply = textareaRef.current?.plainText ?? editedYaml
    if (!yamlToApply || !contextName) return

    setToastMessage("Applying...")
    const result = await applyYamlAsync(contextName, yamlToApply)
    if (result.success) {
      setToastMessage("Applied successfully")
      onRefresh()
    } else {
      setToastMessage(`Apply failed: ${result.message}`)
    }
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
  }, [editedYaml, contextName, onRefresh])

  const handleCancelEdit = useCallback(() => {
    setYamlEditMode("view")
    setEditedYaml("")
  }, [])

  useEffect(() => {
    if (yamlEditMode === "edit") {
      const handler = (key: { name: string }) => {
        if (key.name === "escape") handleCancelEdit()
      }
      renderer.keyInput.on("keypress", handler)
      return () => { renderer.keyInput.off("keypress", handler) }
    }
  }, [yamlEditMode, handleCancelEdit, renderer])

  useEffect(() => {
    if (yamlEditMode === "view") setEditedYaml("")
  }, [yamlEditMode])

  useEffect(() => {
    if (focus !== "details") setYamlEditMode("view")
  }, [focus])

  const selectedDisplay = useMemo(() => {
    if (isYamlDetails) {
      if (yamlEditMode === "edit") {
        return t`${fg("#F85149")("editing")} ${fg("#8B949E")(`${podDetailFull?.ownerKind || ""}/${podDetailFull?.ownerName || ""}`)}`
      }
      return DASH
    }
    if (detailsRows && detailRowIndex >= 0) {
      const display = getSelectedRowDisplay(detailsRows, detailRowIndex)
      if (display.includes("=")) {
        const eqIdx = display.indexOf(" = ")
        const key = display.slice(0, eqIdx)
        const value = display.slice(eqIdx + 3)
        return t`${fg("#8B949E")(key)} ${fg("#484F58")("=")} ${fg("#E6EDF3")(value)}`
      }
      return t`${bold(fg("#58A6FF")(display))}`
    }
    return DASH
  }, [isYamlDetails, yamlEditMode, detailsRows, detailRowIndex, podDetailFull])

  const commands = useMemo(() => {
    if (yamlEditMode === "edit") {
      return t`${fg("#58A6FF")("[ctrl+enter]")} ${fg("#8B949E")("apply  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("cancel")}`
    }
    if (focus === "details") {
      if (isYamlDetails && yamlEditMode === "view") {
        if (canEdit) {
          return t`${fg("#58A6FF")("[↑↓←→]")} ${fg("#8B949E")("scroll  ")}${fg("#58A6FF")("[pgup/pgdn]")} ${fg("#8B949E")("page  ")}${fg("#58A6FF")("[home/end]")} ${fg("#8B949E")("top/bottom  ")}${fg("#58A6FF")("[e]")} ${fg("#8B949E")("dit  ")}${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
        }
        return t`${fg("#58A6FF")("[↑↓←→]")} ${fg("#8B949E")("scroll  ")}${fg("#58A6FF")("[pgup/pgdn]")} ${fg("#8B949E")("page  ")}${fg("#58A6FF")("[home/end]")} ${fg("#8B949E")("top/bottom  ")}${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
      }
      if (detailsRows && !isYamlDetails) {
        return t`${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("scroll  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("copy  ")}${fg("#58A6FF")("[pgup/pgdn]")} ${fg("#8B949E")("page  ")}${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
      }
      return t`${fg("#58A6FF")("[←]")} ${fg("#8B949E")("focus left  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
    }
    return t`${fg("#58A6FF")("[tab]")} ${fg("#8B949E")("cycle  ")}${fg("#58A6FF")("[→]")} ${fg("#8B949E")("details  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
  }, [yamlEditMode, focus, isYamlDetails, canEdit, detailsRows])

  const detailsBorderColor = useMemo(() => {
    if (yamlEditMode === "edit") return "#F85149"
    if (focus === "details") return "#58A6FF"
    return "#30363D"
  }, [yamlEditMode, focus])

  const detailsTitle = useMemo(() => {
    if (yamlEditMode === "edit") {
      return `EDITING: ${podDetailFull?.ownerKind || ""}/${podDetailFull?.ownerName || ""}`
    }
    if (lastLeftBox === "containers") {
      const name = podDetailFull?.containers[containerIndex]?.name || ""
      return name
    }
    if (lastLeftBox === "application") {
      const r = podDetailFull?.appResources[appResourceIndex]
      return r ? `${r.kind}: ${r.name}` : "APPLICATION"
    }
    if (lastLeftBox === "manifests") {
      if (manifestIndex === 0 && hasOriginalManifest) return "ORIGINAL MANIFEST"
      return "LIVE MANIFEST"
    }
    return "DETAILS"
  }, [yamlEditMode, lastLeftBox, podDetailFull, containerIndex, appResourceIndex, manifestIndex, hasOriginalManifest])

  return (
    <>
      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <box style={{ flexDirection: "column", width: 28, gap: 0 }}>
          <PodHeader pod={pod} podDetailFull={podDetailFull} spinner={localSpinner} />

          <ContainersBox
            containers={podDetailFull?.containers || []}
            selectedIndex={containerIndex}
            focused={leftBoxFocused("containers")}
            loading={loading}
            spinner={localSpinner}
          />

          <ApplicationBox
            resources={podDetailFull?.appResources || []}
            selectedIndex={appResourceIndex}
            focused={leftBoxFocused("application")}
            containerRefNames={containerRefNames}
            loading={loading}
            spinner={localSpinner}
          />

          <ManifestsBox
            hasOriginal={hasOriginalManifest}
            selectedIndex={manifestIndex}
            focused={leftBoxFocused("manifests")}
            loading={loading}
            spinner={localSpinner}
          />
        </box>

        <box style={{ flexDirection: "column", flexGrow: 1, gap: 0 }}>
          <box
            title={detailsTitle}
            borderStyle="single"
            borderColor={detailsBorderColor}
            style={{ flexDirection: "column", flexGrow: 1 }}
          >
            <DetailsPanel
              rows={detailsRows}
              yaml={detailsYaml}
              yamlMode={yamlEditMode}
              editEnabled={isOriginalYaml}
              scrollOffset={detailScrollOffset}
              detailRowIndex={detailRowIndex}
              scrollRef={yamlScrollRef}
              textareaRef={textareaRef}
              onContentChange={() => {
                if (textareaRef.current) setEditedYaml(textareaRef.current.plainText ?? "")
              }}
              onSubmit={handleApply}
              loading={loading}
              spinner={localSpinner}
            />
          </box>
          <box
            title="SELECTED"
            borderStyle="single"
            borderColor="#30363D"
            style={{ flexDirection: "column", height: 3 }}
          >
            <text content={typeof selectedDisplay === "string" ? selectedDisplay : selectedDisplay} />
          </box>
        </box>
        <Toast message={toastMessage} />
      </box>

      <CommandsBar content={commands} />
    </>
  )
}
