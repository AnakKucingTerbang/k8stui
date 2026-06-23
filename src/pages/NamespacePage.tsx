import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { CommandsBar } from "../components/CommandsBar"
import { PodTable } from "../components/PodTable"
import { ResourceListTable } from "../components/ResourceListTable"
import type { PodDetail, NamespacedResource, MetricMode } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type NamespaceView = "workloads" | "pods" | "network" | "config"
type Focus = "left" | "right"

const LEFT_VIEWS: NamespaceView[] = ["workloads", "pods", "network", "config"]
const VIEW_LABELS: Record<NamespaceView, string> = {
  workloads: "Workloads",
  pods: "Pods",
  network: "Network",
  config: "Config",
}
const VIEW_TITLES: Record<NamespaceView, string> = {
  workloads: "WORKLOADS",
  pods: "PODS",
  network: "NETWORK",
  config: "CONFIG",
}

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
  const [leftIndex, setLeftIndex] = useState(0)
  const [focus, setFocus] = useState<Focus>("left")
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

  const activeView = LEFT_VIEWS[leftIndex]!

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
  }, [namespace, leftIndex])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const currentList = useMemo((): { items: NamespacedResource[] | PodDetail[]; index: number; scrollRef: React.RefObject<any>; idPrefix: string } => {
    if (activeView === "workloads") return { items: workloads, index: wlIndex, scrollRef: wlScrollRef, idPrefix: "res" }
    if (activeView === "pods") return { items: pods, index: podIndex, scrollRef: podScrollRef, idPrefix: "pod" }
    if (activeView === "network") return { items: network, index: netIndex, scrollRef: netScrollRef, idPrefix: "res" }
    return { items: config, index: cfgIndex, scrollRef: cfgScrollRef, idPrefix: "res" }
  }, [activeView, workloads, pods, network, config, wlIndex, podIndex, netIndex, cfgIndex])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "up") {
        if (focus === "left") {
          if (leftIndex > 0) setLeftIndex((i) => i - 1)
        } else {
          const vis = getViewportBounds(currentList.scrollRef)
          let idx = currentList.index
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.min(vis.last, currentList.items.length - 1)
          }
          if (idx > 0) {
            const newIdx = idx - 1
            if (activeView === "workloads") setWlIndex(newIdx)
            else if (activeView === "pods") setPodIndex(newIdx)
            else if (activeView === "network") setNetIndex(newIdx)
            else setCfgIndex(newIdx)
            scrollIntoView(currentList.scrollRef, `${currentList.idPrefix}-${newIdx}`)
          }
        }
      } else if (key.name === "down") {
        if (focus === "left") {
          if (leftIndex < LEFT_VIEWS.length - 1) setLeftIndex((i) => i + 1)
        } else {
          const vis = getViewportBounds(currentList.scrollRef)
          let idx = currentList.index
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.max(vis.first, 0)
          }
          if (idx < currentList.items.length - 1) {
            const newIdx = idx + 1
            if (activeView === "workloads") setWlIndex(newIdx)
            else if (activeView === "pods") setPodIndex(newIdx)
            else if (activeView === "network") setNetIndex(newIdx)
            else setCfgIndex(newIdx)
            scrollIntoView(currentList.scrollRef, `${currentList.idPrefix}-${newIdx}`)
          }
        }
      } else if (key.name === "right") {
        if (focus === "left") setFocus("right")
      } else if (key.name === "left") {
        if (focus === "right") setFocus("left")
      } else if (key.name === "return") {
        if (focus === "right") {
          if (activeView === "workloads") {
            const res = workloads[wlIndex]
            if (res) onOpenWorkload(res.kind, res.name, res.namespace)
          } else if (activeView === "pods") {
            const pod = pods[podIndex]
            if (pod) onOpenPod(pod)
          } else if (activeView === "network") {
            const res = network[netIndex]
            if (res) onOpenNetwork(res.kind, res.name, res.namespace)
          } else if (activeView === "config") {
            const res = config[cfgIndex]
            if (res) onOpenConfig(res.kind, res.name, res.namespace)
          }
        }
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [focus, leftIndex, activeView, wlIndex, podIndex, netIndex, cfgIndex, workloads, pods, network, config, currentList, onOpenWorkload, onOpenPod, onOpenNetwork, onOpenConfig, onBack, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const leftBorderColor = focus === "left" ? "#58A6FF" : "#30363D"
  const rightBorderColor = focus === "right" ? "#58A6FF" : "#30363D"

  const rightTitle = useMemo(() => VIEW_TITLES[activeView], [activeView])

  const commands = useMemo(() => {
    if (focus === "right") {
      return t`${fg("#58A6FF")("[←→]")} ${fg("#8B949E")("focus  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("open  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
    }
    return t`${fg("#58A6FF")("[←→]")} ${fg("#8B949E")("focus  ")}${fg("#58A6FF")("[↑↓]")} ${fg("#8B949E")("nav  ")}${fg("#58A6FF")("[→]")} ${fg("#8B949E")("details  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
  }, [focus])

  const renderRightContent = () => {
    if (loading) {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading namespace data...")}`} />
          <text fg="#484F58" content={`Fetching from ${namespace}...`} />
        </box>
      )
    }

    if (activeView === "workloads") {
      return <ResourceListTable resources={workloads} selectedIndex={wlIndex} scrollRef={wlScrollRef} />
    }

    if (activeView === "pods") {
      return <PodTable pods={pods} selectedIndex={podIndex} scrollRef={podScrollRef} metricMode={metricMode} />
    }

    if (activeView === "network") {
      return <ResourceListTable resources={network} selectedIndex={netIndex} scrollRef={netScrollRef} />
    }

    return <ResourceListTable resources={config} selectedIndex={cfgIndex} scrollRef={cfgScrollRef} />
  }

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
              const label = VIEW_LABELS[view]
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
    </>
  )
}
