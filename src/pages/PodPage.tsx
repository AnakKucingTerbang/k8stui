import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import { PodHeader } from "../components/PodHeader"
import { ContainersBox } from "../components/ContainersBox"
import { ApplicationBox } from "../components/ApplicationBox"
import { ManifestsBox, type ManifestItem } from "../components/ManifestsBox"
import { DetailsPanel, getSelectedRowDisplay } from "../components/DetailsPanel"
import { LogsBox } from "../components/LogsBox"
import { LogView } from "../components/LogView"
import { CommandsBar } from "../components/CommandsBar"
import { Toast } from "../components/Toast"
import { copyToClipboard } from "../utils/clipboard"
import { applyYamlAsync } from "../utils/kube"
import { streamPodLogs, trimLogBuffer, getSinceOption, SINCE_OPTIONS, type LogStreamHandle } from "../utils/kube-logs"
import type { PodDetail, PodDetailFull, PodContainer, DetailRow } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type LeftBox = "containers" | "application" | "manifests" | "logs"
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

function shortKind(kind: string): string {
  switch (kind) {
    case "Deployment": return "Deploy"
    case "StatefulSet": return "Sts"
    case "DaemonSet": return "DS"
    case "PersistentVolumeClaim": return "PVC"
    case "ConfigMap": return "CM"
    case "Secret": return "Secret"
    case "Service": return "SVC"
    case "Ingress": return "Ingress"
    default: return kind
  }
}

interface PodDetailPageProps {
  pod: PodDetail
  podDetailFull: PodDetailFull | null
  onBack: () => void
  onQuit: () => void
  onRefresh: () => void
  contextName: string
}

const LEFT_ORDER: LeftBox[] = ["containers", "application", "manifests", "logs"]

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

  const [logs, setLogs] = useState<string[]>([])
  const [logsStreaming, setLogsStreaming] = useState(false)
  const [logsSinceKey, setLogsSinceKey] = useState("0")
  const [logsPrevious, setLogsPrevious] = useState(false)
  const [logsWrap, setLogsWrap] = useState(true)

  useEffect(() => {
    setContainerIndex(0)
    setAppResourceIndex(0)
    setManifestIndex(0)
  }, [pod.name])

  useEffect(() => {
    setLogs([])
    setLogsStreaming(false)
    setLogsSinceKey("0")
    setLogsPrevious(false)
    setLogsWrap(true)
  }, [pod.name])

  const [detailScrollOffset, setDetailScrollOffset] = useState(0)
  const [detailRowIndex, setDetailRowIndex] = useState(-1)
  const [yamlEditMode, setYamlEditMode] = useState<YamlEditMode>("view")
  const [editedYaml, setEditedYaml] = useState("")
  const [toastMessage, setToastMessage] = useState("")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const yamlScrollRef = useRef<any>(null)
  const logsScrollRef = useRef<any>(null)
  const textareaRef = useRef<any>(null)
  const logStreamRef = useRef<LogStreamHandle | null>(null)
  const renderer = useRenderer()

  const localSpinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const isLoading = !podDetailFull || podDetailFull.appResources === undefined

  useEffect(() => {
    if (!isLoading) {
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
  }, [isLoading])

  const { height: termHeight } = useTerminalDimensions()
  const maxVisibleRows = Math.max(1, termHeight - 24)

  const currentSince = getSinceOption(logsSinceKey)
  const sinceLabel = currentSince?.label ?? "LIVE"

  const startLogStream = useCallback((containerName: string, sinceKey: string, previous: boolean) => {
    if (logStreamRef.current) {
      logStreamRef.current.abort()
      logStreamRef.current = null
    }

    const since = getSinceOption(sinceKey)
    if (!since || !containerName || !contextName || !pod.name || !pod.namespace) {
      setLogsStreaming(false)
      return
    }

    setLogsStreaming(true)
    setLogs([])

    const opts: import("../utils/kube-logs").StreamLogOptions = {
      contextName,
      podName: pod.name,
      namespace: pod.namespace,
      containerName,
      follow: !previous,
      previous,
      tailLines: since.tailLines ?? 100,
      sinceSeconds: since.sinceSeconds,
      timestamps: true,
      onLine: (line) => {
        setLogs((prev) => trimLogBuffer([...prev, line]))
      },
      onError: (err: Error) => {
        setToastMessage(`Log error: ${err.message}`)
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
        toastTimerRef.current = setTimeout(() => setToastMessage(""), 5000)
      },
      onEnd: () => {
        setLogsStreaming(false)
      },
    }

    logStreamRef.current = streamPodLogs(opts)
  }, [contextName, pod.name, pod.namespace])

  useEffect(() => {
    const containerName = podDetailFull?.containers[containerIndex]?.name
    if (lastLeftBox === "logs" && containerName) {
      startLogStream(containerName, logsSinceKey, logsPrevious)
    }
    if (lastLeftBox !== "logs" && logStreamRef.current) {
      logStreamRef.current.abort()
      logStreamRef.current = null
      setLogsStreaming(false)
    }
  }, [containerIndex, lastLeftBox, podDetailFull?.containers, logsSinceKey, logsPrevious, startLogStream])

  useEffect(() => {
    return () => {
      if (logStreamRef.current) {
        logStreamRef.current.abort()
        logStreamRef.current = null
      }
    }
  }, [])

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
  const canEdit = lastLeftBox === "manifests" && !isLiveManifest && detailsYaml !== undefined && yamlEditMode === "view"

  const activeYaml = useMemo(() => {
    if (yamlEditMode === "edit") return editedYaml || detailsYaml || ""
    return detailsYaml || ""
  }, [yamlEditMode, editedYaml, detailsYaml])

  const isLogsView = lastLeftBox === "logs"

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
      } else if (key.name === "w") {
        if (isLogsView) {
          setLogsWrap((v) => !v)
        }
      } else if (key.name === "p") {
        if (isLogsView) {
          setLogsPrevious((v) => !v)
        }
      } else if (key.name === "[") {
        if (focus === "details" && isLogsView && !logsWrap) {
          logsScrollRef.current?.scrollBy({ x: -5, y: 0 })
        }
      } else if (key.name === "]") {
        if (focus === "details" && isLogsView && !logsWrap) {
          logsScrollRef.current?.scrollBy({ x: 5, y: 0 })
        }
      } else if (key.name === "0") {
        if (isLogsView) {
          setLogsSinceKey("0")
        }
      } else if (key.name === "1") {
        if (isLogsView) {
          setLogsSinceKey("1")
        }
      } else if (key.name === "2") {
        if (isLogsView) {
          setLogsSinceKey("2")
        }
      } else if (key.name === "3") {
        if (isLogsView) {
          setLogsSinceKey("3")
        }
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
      isYamlDetails, isLogsView, logsPrevious, logsWrap, yamlEditMode, canEdit, activeYaml, maxVisibleRows,
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

  useEffect(() => {
    const max = (manifestItems?.length ?? 0) - 1
    if (manifestIndex > max && max >= 0) setManifestIndex(max)
  }, [manifestItems?.length, manifestIndex])

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
      if (yamlEditMode === "edit") {
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
  }, [isLogsView, isYamlDetails, yamlEditMode, detailsRows, detailRowIndex, podDetailFull, containerIndex, logsStreaming, logsPrevious, sinceLabel, editingLabel])

  const commands = useMemo(() => {
    if (yamlEditMode === "edit") {
      return t`${fg("#58A6FF")("[ctrl+enter]")} ${fg("#8B949E")("apply  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("cancel")}`
    }
    if (focus === "details" && isLogsView) {
      if (!logsWrap) {
        return t`${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("scroll  ")}${fg("#58A6FF")("[w]")} ${fg("#8B949E")("wrap  ")}${fg("#58A6FF")("[p]")} ${fg("#8B949E")("prev  ")}${fg("#58A6FF")("[0]")} ${fg("#8B949E")("live  ")}${fg("#58A6FF")("[1]")} ${fg("#8B949E")("5m  ")}${fg("#58A6FF")("[2]")} ${fg("#8B949E")("30m  ")}${fg("#58A6FF")("[3]")} ${fg("#8B949E")("3h  ")}${fg("#58A6FF")("[ [ ] ]")} ${fg("#8B949E")("horiz  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
      }
      return t`${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("scroll  ")}${fg("#58A6FF")("[w]")} ${fg("#8B949E")("nowrap  ")}${fg("#58A6FF")("[p]")} ${fg("#8B949E")("prev  ")}${fg("#58A6FF")("[0]")} ${fg("#8B949E")("live  ")}${fg("#58A6FF")("[1]")} ${fg("#8B949E")("5m  ")}${fg("#58A6FF")("[2]")} ${fg("#8B949E")("30m  ")}${fg("#58A6FF")("[3]")} ${fg("#8B949E")("3h  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
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
    if (focus === "logs") {
      return t`${fg("#58A6FF")("[→]")} ${fg("#8B949E")("logs  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("container  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
    }
    return t`${fg("#58A6FF")("[tab]")} ${fg("#8B949E")("cycle  ")}${fg("#58A6FF")("[→]")} ${fg("#8B949E")("details  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
  }, [yamlEditMode, focus, isYamlDetails, isLogsView, canEdit, detailsRows, logsWrap])

  const detailsBorderColor = useMemo(() => {
    if (yamlEditMode === "edit") return "#F85149"
    if (focus === "details" && isLogsView) {
      if (logsPrevious) return "#D29922"
      return logsStreaming ? "#3FB950" : "#58A6FF"
    }
    if (focus === "details") return "#58A6FF"
    return "#30363D"
  }, [yamlEditMode, focus, isLogsView, logsStreaming, logsPrevious])

  const detailsTitle = useMemo(() => {
    if (yamlEditMode === "edit") {
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
  }, [yamlEditMode, lastLeftBox, podDetailFull, containerIndex, appResourceIndex, manifestIndex, manifestItems, isLiveManifest, editingLabel, logsPrevious])

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
          <box
            title={detailsTitle}
            borderStyle="single"
            borderColor={detailsBorderColor}
            style={{ flexDirection: "column", flexGrow: 1 }}
          >
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
                yamlMode={yamlEditMode}
                editEnabled={canEdit}
                scrollOffset={detailScrollOffset}
                detailRowIndex={detailRowIndex}
                scrollRef={yamlScrollRef}
                textareaRef={textareaRef}
                onContentChange={() => {
                  if (textareaRef.current) setEditedYaml(textareaRef.current.plainText ?? "")
                }}
                onSubmit={handleApply}
                spinner={localSpinner}
              />
            )}
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
