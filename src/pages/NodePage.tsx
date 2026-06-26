import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Section } from "../components/Section"
import { Panel } from "../components/Panel"
import { CommandsBar, type CommandItem } from "../components/CommandsBar"
import { NodeBars } from "../components/NodeDetail"
import { PodTable } from "../components/PodTable"
import { ConditionsTable } from "../components/ConditionsTable"
import type { NodeDetail, NodeCondition, PodDetail, MetricMode } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type NodeView = "pods" | "conditions"
type Focus = "left" | "right"

const LEFT_VIEWS: NodeView[] = ["pods", "conditions"]
const VIEW_LABELS: Record<NodeView, string> = {
  pods: "Pods",
  conditions: "Conditions",
}
const VIEW_TITLES: Record<NodeView, string> = {
  pods: "PODS",
  conditions: "CONDITIONS",
}

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
  const [leftIndex, setLeftIndex] = useState(0)
  const [focus, setFocus] = useState<Focus>("left")
  const [podListIndex, setPodListIndex] = useState(0)
  const [condListIndex, setCondListIndex] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const podScrollRef = useRef<any>(null)
  const condScrollRef = useRef<any>(null)
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
    setPodListIndex(0)
    setCondListIndex(0)
  }, [node.name, leftIndex])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "up") {
        if (focus === "left") {
          if (leftIndex > 0) setLeftIndex((i) => i - 1)
        } else if (activeView === "pods") {
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
        } else if (activeView === "conditions") {
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
        if (focus === "left") {
          if (leftIndex < LEFT_VIEWS.length - 1) setLeftIndex((i) => i + 1)
        } else if (activeView === "pods") {
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
        } else if (activeView === "conditions") {
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
      } else if (key.name === "right") {
        if (focus === "left") setFocus("right")
      } else if (key.name === "left") {
        if (focus === "right") setFocus("left")
      } else if (key.name === "return") {
        if (focus === "right" && activeView === "pods") {
          const pod = pods[podListIndex]
          if (pod) onOpenPod(pod)
        }
      } else if (key.name === "m") {
        onToggleMetric()
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [focus, leftIndex, activeView, podListIndex, condListIndex, pods, conditions, onOpenPod, onBack, onToggleMetric, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const rightTitle = useMemo(() => VIEW_TITLES[activeView], [activeView])

  const commands = useMemo<CommandItem[]>(() => {
    if (focus === "right" && activeView === "pods") {
      return [
        { key: "[←→]", label: "focus" },
        { key: "[↑↓]", label: "nav" },
        { key: "[enter]", label: "open" },
        { key: "[m]", label: "etric" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    if (focus === "right" && activeView === "conditions") {
      return [
        { key: "[←→]", label: "focus" },
        { key: "[↑↓]", label: "nav" },
        { key: "[m]", label: "etric" },
        { key: "[esc]", label: "back" },
        { key: "[q]", label: "uit" },
      ]
    }
    return [
      { key: "[←→]", label: "focus" },
      { key: "[↑↓]", label: "nav" },
      { key: "[→]", label: "details" },
      { key: "[m]", label: "etric" },
      { key: "[esc]", label: "back" },
      { key: "[q]", label: "uit" },
    ]
  }, [focus, activeView])

  const renderRightContent = () => {
    if (loading) {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading...")}`} />
          <text fg="#484F58" content={`Fetching data for ${node.name}...`} />
        </box>
      )
    }

    if (activeView === "pods") {
      return (
        <PodTable
          pods={pods}
          selectedIndex={podListIndex}
          scrollRef={podScrollRef}
          metricMode={metricMode}
          cpuAllocatable={node.cpuAllocatable}
          memAllocatable={node.memAllocatable}
        />
      )
    }

    return (
      <ConditionsTable
        conditions={conditions}
        selectedIndex={condListIndex}
        scrollRef={condScrollRef}
      />
    )
  }

  return (
    <>
      <Section title={`OVERVIEW | ${node.name}`} height={7}>
        <NodeBars node={node} metricMode={metricMode} />
      </Section>

      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <Panel title="VIEWS" focused={focus === "left"} width={20} gap={0}>
          {LEFT_VIEWS.map((view, i) => {
            const isSelected = i === leftIndex
            const bgColor = isSelected ? "#1A3A5C" : undefined
            const textColor = isSelected ? "#E6EDF3" : "#8B949E"
            const label = VIEW_LABELS[view]
            return (
              <box key={view} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                <text content={t`${fg(textColor)(` ${label}`)}`} />
              </box>
            )
          })}
        </Panel>

        <Panel title={rightTitle} focused={focus === "right"} flexGrow={1} gap={0}>
          {renderRightContent()}
        </Panel>
      </box>

      <CommandsBar commands={commands} />
    </>
  )
}
