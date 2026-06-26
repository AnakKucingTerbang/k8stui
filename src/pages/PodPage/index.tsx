import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import { Section } from "../../components/Section"
import { Panel } from "../../components/Panel"
import { PodHeader } from "../../components/PodHeader"
import { ContainersBox } from "../../components/ContainersBox"
import { ApplicationBox } from "../../components/ApplicationBox"
import { ManifestsBox, type ManifestItem } from "../../components/ManifestsBox"
import { DetailsPanel, getSelectedRowDisplay } from "../../components/DetailsPanel"
import { LogsBox } from "../../components/LogsBox"
import { LogView } from "../../components/LogView"
import { CommandsBar, type CommandItem } from "../../components/CommandsBar"
import { Toast } from "../../components/Toast"
import { getSinceOption } from "../../utils/kube-logs"
import type { PodDetail, PodDetailFull, PodContainer, DetailRow } from "../../types"
import {
  SPINNER_FRAMES,
  LEFT_ORDER,
  shortKind,
  type LeftBox,
  type FocusTarget,
  type YamlEditMode,
} from "./types"
import { useLogStream } from "./useLogStream"
import { useKeyboardHandler } from "./useKeyboardHandler"
import { useYamlEdit } from "./useYamlEdit"

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
  onBack: () => void
  onQuit: () => void
  onRefresh: () => void
  contextName: string
}

export function PodPage({
  pod,
  podDetailFull,
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
  const [logsSinceKey, setLogsSinceKey] = useState("0")
  const [logsPrevious, setLogsPrevious] = useState(false)
  const [logsWrap, setLogsWrap] = useState(true)
  const [detailScrollOffset, setDetailScrollOffset] = useState(0)
  const [detailRowIndex, setDetailRowIndex] = useState(-1)
  const [toastMessage, setToastMessage] = useState("")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const yamlScrollRef = useRef<any>(null)
  const logsScrollRef = useRef<any>(null)

  const localSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"
  const isLoading = !podDetailFull || podDetailFull.appResources === undefined

  useEffect(() => {
    setContainerIndex(0)
    setAppResourceIndex(0)
    setManifestIndex(0)
  }, [pod.name])

  useEffect(() => {
    setLogsSinceKey("0")
    setLogsPrevious(false)
    setLogsWrap(true)
  }, [pod.name])

  useEffect(() => {
    if (!isLoading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [isLoading])

  useEffect(() => {
    if (focus !== "details") {
      yamlEdit.setYamlEditMode("view")
    }
  }, [focus])

  const toast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
  }, [])

  const { height: termHeight } = useTerminalDimensions()
  const maxVisibleRows = Math.max(1, termHeight - 24)

  const currentSince = getSinceOption(logsSinceKey)
  const sinceLabel = currentSince?.label ?? "LIVE"

  const { logs, logsStreaming } = useLogStream({
    pod,
    podDetailFull,
    containerIndex,
    lastLeftBox,
    logsSinceKey,
    logsPrevious,
    contextName,
    onToast: toast,
  })

  const yamlEdit = useYamlEdit({
    contextName,
    onRefresh,
    onToast: toast,
  })

  const manifestItems: ManifestItem[] | undefined = useMemo(() => {
    if (!podDetailFull) return undefined
    if (podDetailFull.appResources === undefined) return undefined
    const items: ManifestItem[] = []
    for (const r of podDetailFull.appResources) {
      if (r.lastAppliedYaml) {
        items.push({ label: `${shortKind(r.kind)}: ${r.name}`, hasYaml: true })
      }
    }
    items.push({ label: "Live Manifest", hasYaml: true })
    return items
  }, [podDetailFull])

  const isLiveManifest = manifestItems !== undefined && manifestIndex === manifestItems.length - 1

  useEffect(() => {
    const max = (manifestItems?.length ?? 0) - 1
    if (manifestIndex > max && max >= 0) setManifestIndex(max)
  }, [manifestItems?.length, manifestIndex])

  const detailsRows = useMemo((): DetailRow[] | undefined => {
    if (!podDetailFull) return undefined
    if (lastLeftBox === "containers") {
      const c = podDetailFull.containers[containerIndex]
      return c ? buildContainerRows(c) : undefined
    }
    if (lastLeftBox === "application") {
      const r = podDetailFull.appResources?.[appResourceIndex]
      return r ? r.summaryRows : undefined
    }
    return undefined
  }, [podDetailFull, lastLeftBox, containerIndex, appResourceIndex])

  const detailsYaml = useMemo((): string | undefined => {
    if (lastLeftBox !== "manifests" || !podDetailFull) return undefined
    if (manifestItems === undefined || manifestItems.length === 0) return undefined
    if (isLiveManifest) return podDetailFull.yaml
    const r = podDetailFull.appResources?.filter(r => r.lastAppliedYaml)[manifestIndex]
    return r?.lastAppliedYaml || undefined
  }, [podDetailFull, lastLeftBox, manifestIndex, manifestItems, isLiveManifest])

  const isYamlDetails = detailsYaml !== undefined
  const canEdit = lastLeftBox === "manifests" && !isLiveManifest && detailsYaml !== undefined && yamlEdit.yamlEditMode === "view"

  const activeYaml = useMemo(() => {
    if (yamlEdit.yamlEditMode === "edit") return yamlEdit.editedYaml || detailsYaml || ""
    return detailsYaml || ""
  }, [yamlEdit.yamlEditMode, yamlEdit.editedYaml, detailsYaml])

  const isLogsView = lastLeftBox === "logs"
  const leftBoxFocused = (box: LeftBox): boolean => focus === box

  const handleKey = useKeyboardHandler({
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
    logsPrevious,
    setLogsWrap,
    setLogsPrevious,
    setLogsSinceKey,
    yamlEditMode: yamlEdit.yamlEditMode,
    canEdit,
    activeYaml,
    detailsRows,
    podDetailFull,
    manifestItems,
    logsScrollRef,
    yamlScrollRef,
    onBack,
    onQuit,
    onEdit: () => {
      yamlEdit.setYamlEditMode("edit")
      yamlEdit.setEditedYaml(activeYaml)
    },
    onToast: toast,
  })

  useKeyboard(handleKey)

  const editingLabel = useMemo(() => {
    if (lastLeftBox !== "manifests" || !podDetailFull) return `${podDetailFull?.ownerKind || ""}/${podDetailFull?.ownerName || ""}`
    if (isLiveManifest) return "pod"
    const r = podDetailFull.appResources?.filter(r => r.lastAppliedYaml)[manifestIndex]
    return r ? `${r.kind}: ${r.name}` : ""
  }, [lastLeftBox, podDetailFull, manifestIndex, isLiveManifest])

  const selectedDisplay = useMemo(() => {
    if (isLogsView) {
      const containerName = podDetailFull?.containers[containerIndex]?.name || "──"
      const liveTag = logsStreaming ? fg("#3FB950")("live") : fg("#F85149")("stopped")
      const prevTag = logsPrevious ? fg("#D29922")("previous") : fg("#8B949E")("current")
      return t`${fg("#8B949E")("container")} ${fg("#E6EDF3")(containerName)} ${fg("#484F58")("·")} ${prevTag} ${fg("#484F58")("·")} ${liveTag} ${fg("#484F58")("·")} ${fg("#8B949E")(sinceLabel)}`
    }
    if (isYamlDetails) {
      if (yamlEdit.yamlEditMode === "edit") {
        return t`${fg("#F85149")("editing")} ${fg("#8B949E")(editingLabel)}`
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
  }, [isLogsView, isYamlDetails, yamlEdit.yamlEditMode, detailsRows, detailRowIndex, podDetailFull, containerIndex, logsStreaming, logsPrevious, sinceLabel, editingLabel])

  const commands = useMemo<CommandItem[]>(() => {
    if (yamlEdit.yamlEditMode === "edit") {
      return [
        { key: "[ctrl+enter]", label: "apply" },
        { key: "[esc]", label: "cancel" },
      ]
    }
    if (focus === "details" && isLogsView) {
      if (!logsWrap) {
        return [
          { key: "[↑↓]", label: "scroll" },
          { key: "[w]", label: "wrap" },
          { key: "[p]", label: "prev" },
          { key: "[0]", label: "live" },
          { key: "[1]", label: "5m" },
          { key: "[2]", label: "30m" },
          { key: "[3]", label: "3h" },
          { key: "[ [ ] ]", label: "horiz" },
          { key: "[esc]", label: "back" },
          { key: "[q]", label: "uit" },
        ]
      }
      return [
        { key: "[↑↓]", label: "scroll" },
        { key: "[w]", label: "nowrap" },
        { key: "[p]", label: "prev" },
        { key: "[0]", label: "live" },
        { key: "[1]", label: "5m" },
        { key: "[2]", label: "30m" },
        { key: "[3]", label: "3h" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    if (focus === "details") {
      if (isYamlDetails && yamlEdit.yamlEditMode === "view") {
        if (canEdit) {
          return [
            { key: "[↑↓←→]", label: "scroll" },
            { key: "[pgup/pgdn]", label: "page" },
            { key: "[home/end]", label: "top/bottom" },
            { key: "[e]", label: "dit" },
            { key: "[←]", label: "focus left" },
            { key: "[esc]", label: "back" },
            { key: "[q]", label: "uit" },
          ]
        }
        return [
          { key: "[↑↓←→]", label: "scroll" },
          { key: "[pgup/pgdn]", label: "page" },
          { key: "[home/end]", label: "top/bottom" },
          { key: "[←]", label: "focus left" },
          { key: "[esc]", label: "back" },
          { key: "[q]", label: "uit" },
        ]
      }
      if (detailsRows && !isYamlDetails) {
        return [
          { key: "[↑↓]", label: "scroll" },
          { key: "[enter]", label: "copy" },
          { key: "[pgup/pgdn]", label: "page" },
          { key: "[←]", label: "focus left" },
          { key: "[esc]", label: "back" },
          { key: "[q]", label: "uit" },
        ]
      }
      return [
        { key: "[←]", label: "focus left" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    if (focus === "logs") {
      return [
        { key: "[→]", label: "logs" },
        { key: "[↑↓]", label: "container" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    return [
      { key: "[tab]", label: "cycle" },
      { key: "[→]", label: "details" },
      { key: "[↑↓]", label: "nav" },
      { key: "[esc]", label: "back" },
      { key: "[q]", label: "uit" },
    ]
  }, [yamlEdit.yamlEditMode, focus, isYamlDetails, isLogsView, canEdit, detailsRows, logsWrap])

  const detailsBorderColor = useMemo(() => {
    if (yamlEdit.yamlEditMode === "edit") return "#F85149"
    if (focus === "details" && isLogsView) {
      if (logsPrevious) return "#D29922"
      return logsStreaming ? "#3FB950" : "#58A6FF"
    }
    if (focus === "details") return "#58A6FF"
    return "#30363D"
  }, [yamlEdit.yamlEditMode, focus, isLogsView, logsStreaming, logsPrevious])

  const detailsTitle = useMemo(() => {
    if (yamlEdit.yamlEditMode === "edit") {
      return `EDITING: ${editingLabel}`
    }
    if (lastLeftBox === "containers") {
      const name = podDetailFull?.containers[containerIndex]?.name || ""
      return name
    }
    if (lastLeftBox === "application") {
      const r = podDetailFull?.appResources?.[appResourceIndex]
      return r ? `${r.kind}: ${r.name}` : "APPLICATION"
    }
    if (lastLeftBox === "manifests") {
      if (!manifestItems || manifestItems.length === 0) return "MANIFESTS"
      if (isLiveManifest) return "LIVE MANIFEST"
      const item = manifestItems[manifestIndex]
      return item?.label || "MANIFEST"
    }
    if (lastLeftBox === "logs") {
      const containerName = podDetailFull?.containers[containerIndex]?.name || "──"
      const prefix = logsPrevious ? "PREV LOGS" : "LOGS"
      return `${prefix}: ${containerName}`
    }
    return "DETAILS"
  }, [yamlEdit.yamlEditMode, lastLeftBox, podDetailFull, containerIndex, appResourceIndex, manifestIndex, manifestItems, isLiveManifest, editingLabel, logsPrevious])

  return (
    <>
      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <box style={{ flexDirection: "column", width: 28, gap: 0 }}>
          <PodHeader pod={pod} podDetailFull={podDetailFull} spinner={localSpinner} />

          <ContainersBox
            containers={podDetailFull?.containers || []}
            selectedIndex={containerIndex}
            focused={leftBoxFocused("containers")}
            spinner={localSpinner}
          />

          <ApplicationBox
            resources={podDetailFull?.appResources}
            selectedIndex={appResourceIndex}
            focused={leftBoxFocused("application")}
            spinner={localSpinner}
          />

          <ManifestsBox
            items={manifestItems}
            selectedIndex={manifestIndex}
            focused={leftBoxFocused("manifests")}
            spinner={localSpinner}
          />

          <LogsBox
            containerName={podDetailFull?.containers[containerIndex]?.name || "──"}
            focused={leftBoxFocused("logs")}
            streaming={logsStreaming}
            sinceLabel={sinceLabel}
            previous={logsPrevious}
            wrap={logsWrap}
            spinner={localSpinner}
          />
        </box>

        <box style={{ flexDirection: "column", flexGrow: 1, gap: 0 }}>
          <Panel title={detailsTitle} borderColor={detailsBorderColor} flexGrow={1}>
            {isLogsView ? (
              <LogView
                lines={logs}
                scrollRef={logsScrollRef}
                streaming={logsStreaming}
                previous={logsPrevious}
                wrap={logsWrap}
              />
            ) : (
              <DetailsPanel
                rows={detailsRows}
                yaml={detailsYaml}
                yamlMode={yamlEdit.yamlEditMode}
                editEnabled={canEdit}
                scrollOffset={detailScrollOffset}
                detailRowIndex={detailRowIndex}
                scrollRef={yamlScrollRef}
                textareaRef={yamlEdit.textareaRef}
                onContentChange={() => {
                  if (yamlEdit.textareaRef.current) yamlEdit.setEditedYaml(yamlEdit.textareaRef.current.plainText ?? "")
                }}
                onSubmit={yamlEdit.handleApply}
                spinner={localSpinner}
              />
            )}
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
