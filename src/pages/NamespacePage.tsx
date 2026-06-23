import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { CommandsBar } from "../components/CommandsBar"
import { PodTable } from "../components/PodTable"
import { ResourceListTable } from "../components/ResourceListTable"
import type { PodDetail, NamespacedResource, MetricMode } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type NamespaceView = "workloads" | "pods" | "network" | "config"

function getViewportBounds(scrollRef: React.RefObject<any>): { first: number; last: number } | null {
  const scroll = scrollRef.current
  if (!scroll) return null
  const top = Math.floor(scroll.scrollTop ?? 0)
  const h = scroll.viewport?.measuredHeight ?? scroll.viewport?.height ?? scroll.height ?? scroll.measuredHeight ?? 20
  return { first: top, last: Math.max(top, top + h - 1) }
}

interface NamespacePageProps {
  namespace: string
  workloads: NamespacedResource[]
  pods: PodDetail[]
  network: NamespacedResource[]
  config: NamespacedResource[]
  loading: boolean
  metricMode: MetricMode
  onOpenWorkload: (kind: string, name: string, namespace: string) => void
  onOpenPod: (pod: PodDetail) => void
  onOpenNetwork: (kind: string, name: string, namespace: string) => void
  onOpenConfig: (kind: string, name: string, namespace: string) => void
  onBack: () => void
  onQuit: () => void
}

export function NamespacePage({
  namespace,
  workloads,
  pods,
  network,
  config,
  loading,
  metricMode,
  onOpenWorkload,
  onOpenPod,
  onOpenNetwork,
  onOpenConfig,
  onBack,
  onQuit,
}: NamespacePageProps) {
  const [view, setView] = useState<NamespaceView>("workloads")
  const [wlIndex, setWlIndex] = useState(0)
  const [podIndex, setPodIndex] = useState(0)
  const [netIndex, setNetIndex] = useState(0)
  const [cfgIndex, setCfgIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wlScrollRef = useRef<any>(null)
  const podScrollRef = useRef<any>(null)
  const netScrollRef = useRef<any>(null)
  const cfgScrollRef = useRef<any>(null)
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
    setWlIndex(0)
    setPodIndex(0)
    setNetIndex(0)
    setCfgIndex(0)
  }, [namespace])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const currentList = useMemo((): { items: NamespacedResource[] | PodDetail[]; index: number; scrollRef: React.RefObject<any>; idPrefix: string } => {
    if (view === "workloads") return { items: workloads, index: wlIndex, scrollRef: wlScrollRef, idPrefix: "res" }
    if (view === "pods") return { items: pods, index: podIndex, scrollRef: podScrollRef, idPrefix: "pod" }
    if (view === "network") return { items: network, index: netIndex, scrollRef: netScrollRef, idPrefix: "res" }
    return { items: config, index: cfgIndex, scrollRef: cfgScrollRef, idPrefix: "res" }
  }, [view, workloads, pods, network, config, wlIndex, podIndex, netIndex, cfgIndex])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "1") {
        setView("workloads")
        setWlIndex(0)
      } else if (key.name === "2") {
        setView("pods")
        setPodIndex(0)
      } else if (key.name === "3") {
        setView("network")
        setNetIndex(0)
      } else if (key.name === "4") {
        setView("config")
        setCfgIndex(0)
      } else if (key.name === "up") {
        const vis = getViewportBounds(currentList.scrollRef)
        let idx = currentList.index
        if (vis && (idx < vis.first || idx > vis.last)) {
          idx = Math.min(vis.last, currentList.items.length - 1)
        }
        if (idx > 0) {
          const newIdx = idx - 1
          if (view === "workloads") setWlIndex(newIdx)
          else if (view === "pods") setPodIndex(newIdx)
          else if (view === "network") setNetIndex(newIdx)
          else setCfgIndex(newIdx)
          scrollIntoView(currentList.scrollRef, `${currentList.idPrefix}-${newIdx}`)
        }
      } else if (key.name === "down") {
        const vis = getViewportBounds(currentList.scrollRef)
        let idx = currentList.index
        if (vis && (idx < vis.first || idx > vis.last)) {
          idx = Math.max(vis.first, 0)
        }
        if (idx < currentList.items.length - 1) {
          const newIdx = idx + 1
          if (view === "workloads") setWlIndex(newIdx)
          else if (view === "pods") setPodIndex(newIdx)
          else if (view === "network") setNetIndex(newIdx)
          else setCfgIndex(newIdx)
          scrollIntoView(currentList.scrollRef, `${currentList.idPrefix}-${newIdx}`)
        }
      } else if (key.name === "return") {
        if (view === "workloads") {
          const res = workloads[wlIndex]
          if (res) onOpenWorkload(res.kind, res.name, res.namespace)
        } else if (view === "pods") {
          const pod = pods[podIndex]
          if (pod) onOpenPod(pod)
        } else if (view === "network") {
          const res = network[netIndex]
          if (res) onOpenNetwork(res.kind, res.name, res.namespace)
        } else if (view === "config") {
          const res = config[cfgIndex]
          if (res) onOpenConfig(res.kind, res.name, res.namespace)
        }
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [view, wlIndex, podIndex, netIndex, cfgIndex, workloads, pods, network, config, currentList, onOpenWorkload, onOpenPod, onOpenNetwork, onOpenConfig, onBack, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const tabTitle = useMemo(() => {
    if (view === "workloads") return "WORKLOADS"
    if (view === "pods") return "PODS"
    if (view === "network") return "NETWORK"
    return "CONFIG"
  }, [view])

  const commands = useMemo(() => {
    return t`${fg("#58A6FF")("[1]")} ${fg("#8B949E")("workloads  ")}${fg("#58A6FF")("[2]")} ${fg("#8B949E")("pods  ")}${fg("#58A6FF")("[3]")} ${fg("#8B949E")("network  ")}${fg("#58A6FF")("[4]")} ${fg("#8B949E")("config  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("open  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
  }, [])

  return (
    <>
      <box
        title={`NAMESPACE | ${namespace}`}
        borderStyle="single"
        borderColor="#30363D"
        style={{ flexDirection: "column", height: 5, width: "100%" }}
      >
        <box style={{ flexDirection: "row", paddingLeft: 1, paddingTop: 1, gap: 2 }}>
          <text content={t`${fg("#8B949E")("workloads:")} ${fg("#E6EDF3")(`${workloads.length}`)}  ${fg("#8B949E")("pods:")} ${fg("#E6EDF3")(`${pods.length}`)}  ${fg("#8B949E")("network:")} ${fg("#E6EDF3")(`${network.length}`)}  ${fg("#8B949E")("config:")} ${fg("#E6EDF3")(`${config.length}`)}`} />
        </box>
      </box>
      <box
        title={tabTitle}
        borderStyle="single"
        borderColor="#58A6FF"
        style={{ flexDirection: "column", flexGrow: 1, width: "100%" }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading namespace data...")}`} />
            <text fg="#484F58" content={`Fetching from ${namespace}...`} />
          </box>
        ) : view === "workloads" ? (
          <ResourceListTable resources={workloads} selectedIndex={wlIndex} scrollRef={wlScrollRef} />
        ) : view === "pods" ? (
          <PodTable pods={pods} selectedIndex={podIndex} scrollRef={podScrollRef} metricMode={metricMode} />
        ) : view === "network" ? (
          <ResourceListTable resources={network} selectedIndex={netIndex} scrollRef={netScrollRef} />
        ) : (
          <ResourceListTable resources={config} selectedIndex={cfgIndex} scrollRef={cfgScrollRef} />
        )}
      </box>

      <CommandsBar content={commands} />
    </>
  )
}
