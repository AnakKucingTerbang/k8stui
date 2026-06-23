import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { CommandsBar } from "../components/CommandsBar"
import { NodeBars } from "../components/NodeDetail"
import { PodTable } from "../components/PodTable"
import { ConditionsTable } from "../components/ConditionsTable"
import type { NodeDetail, NodeCondition, PodDetail, MetricMode } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type NodeView = "pods" | "conditions"

function getViewportBounds(scrollRef: React.RefObject<any>): { first: number; last: number } | null {
  const scroll = scrollRef.current
  if (!scroll) return null
  const top = Math.floor(scroll.scrollTop ?? 0)
  const h = scroll.viewport?.measuredHeight ?? scroll.viewport?.height ?? scroll.height ?? scroll.measuredHeight ?? 20
  return { first: top, last: Math.max(top, top + h - 1) }
}

interface NodePageProps {
  node: NodeDetail
  pods: PodDetail[]
  conditions: NodeCondition[]
  loading: boolean
  metricMode: MetricMode
  onOpenPod: (pod: PodDetail) => void
  onBack: () => void
  onToggleMetric: () => void
  onQuit: () => void
}

export function NodePage({
  node,
  pods,
  conditions,
  loading,
  metricMode,
  onOpenPod,
  onBack,
  onToggleMetric,
  onQuit,
}: NodePageProps) {
  const [view, setView] = useState<NodeView>("pods")
  const [podListIndex, setPodListIndex] = useState(0)
  const [condListIndex, setCondListIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const podScrollRef = useRef<any>(null)
  const condScrollRef = useRef<any>(null)
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
    setPodListIndex(0)
    setCondListIndex(0)
  }, [node.name])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "1") {
        setView("pods")
        setPodListIndex(0)
      } else if (key.name === "2") {
        setView("conditions")
        setCondListIndex(0)
      } else if (key.name === "up") {
        if (view === "pods") {
          const vis = getViewportBounds(podScrollRef)
          let idx = podListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.min(vis.last, pods.length - 1)
          }
          if (idx > 0) {
            const newIdx = idx - 1
            setPodListIndex(newIdx)
            scrollIntoView(podScrollRef, `pod-${newIdx}`)
          }
        } else if (view === "conditions") {
          const vis = getViewportBounds(condScrollRef)
          let idx = condListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.min(vis.last, conditions.length - 1)
          }
          if (idx > 0) {
            const newIdx = idx - 1
            setCondListIndex(newIdx)
            scrollIntoView(condScrollRef, `cond-${newIdx}`)
          }
        }
      } else if (key.name === "down") {
        if (view === "pods") {
          const vis = getViewportBounds(podScrollRef)
          let idx = podListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.max(vis.first, 0)
          }
          if (idx < pods.length - 1) {
            const newIdx = idx + 1
            setPodListIndex(newIdx)
            scrollIntoView(podScrollRef, `pod-${newIdx}`)
          }
        } else if (view === "conditions") {
          const vis = getViewportBounds(condScrollRef)
          let idx = condListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.max(vis.first, 0)
          }
          if (idx < conditions.length - 1) {
            const newIdx = idx + 1
            setCondListIndex(newIdx)
            scrollIntoView(condScrollRef, `cond-${newIdx}`)
          }
        }
      } else if (key.name === "return") {
        if (view === "pods") {
          const pod = pods[podListIndex]
          if (pod) onOpenPod(pod)
        }
      } else if (key.name === "m") {
        onToggleMetric()
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [view, podListIndex, condListIndex, pods, conditions, onOpenPod, onBack, onToggleMetric, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const tabTitle = useMemo(() => {
    if (view === "pods") return "PODS"
    return "CONDITIONS"
  }, [view])

  const commands = useMemo(() => {
    return t`${fg("#58A6FF")("[1]")} ${fg("#8B949E")("pods  ")}${fg("#58A6FF")("[2]")} ${fg("#8B949E")("conditions  ")}${fg("#58A6FF")("[enter]")} ${fg("#8B949E")("open  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[m]")} ${fg("#8B949E")("etric  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
  }, [])

  return (
    <>
      <box
        title={`OVERVIEW | ${node.name}`}
        borderStyle="single"
        borderColor="#30363D"
        style={{ flexDirection: "column", height: 7, width: "100%" }}
      >
        <NodeBars node={node} metricMode={metricMode} />
      </box>
      <box
        title={tabTitle}
        borderStyle="single"
        borderColor="#58A6FF"
        style={{ flexDirection: "column", flexGrow: 1, width: "100%" }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
            <text fg="#484F58" content={`Fetching data for ${node.name}...`} />
          </box>
        ) : view === "pods" ? (
          <PodTable
            pods={pods}
            selectedIndex={podListIndex}
            scrollRef={podScrollRef}
            metricMode={metricMode}
            cpuAllocatable={node.cpuAllocatable}
            memAllocatable={node.memAllocatable}
          />
        ) : (
          <ConditionsTable
            conditions={conditions}
            selectedIndex={condListIndex}
            scrollRef={condScrollRef}
          />
        )}
      </box>

      <CommandsBar content={commands} />
    </>
  )
}
