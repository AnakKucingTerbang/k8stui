import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { CommandsBar } from "../components/CommandsBar"
import { NodeBars, PodTable } from "../components/NodeDetail"
import type { NodeDetail, PodDetail, MetricMode } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

interface NodeDetailPageProps {
  node: NodeDetail
  pods: PodDetail[]
  loading: boolean
  metricMode: MetricMode
  onOpenPod: (pod: PodDetail) => void
  onBack: () => void
  onToggleMetric: () => void
  onQuit: () => void
}

export function NodeDetailPage({
  node,
  pods,
  loading,
  metricMode,
  onOpenPod,
  onBack,
  onToggleMetric,
  onQuit,
}: NodeDetailPageProps) {
  const [podListIndex, setPodListIndex] = useState(0)
  const [podScrollOffset, setPodScrollOffset] = useState(0)
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  const { height: termHeight } = useTerminalDimensions()
  const maxPodRows = Math.max(1, termHeight - 20)

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "up") {
        if (podListIndex > 0) {
          setPodListIndex((i: number) => i - 1)
          if (podListIndex <= podScrollOffset) {
            setPodScrollOffset((i: number) => Math.max(0, i - 1))
          }
        }
      } else if (key.name === "down") {
        if (podListIndex < pods.length - 1) {
          setPodListIndex((i: number) => i + 1)
          if (podListIndex >= podScrollOffset + maxPodRows - 1) {
            setPodScrollOffset((i: number) => i + 1)
          }
        }
      } else if (key.name === "return") {
        const pod = pods[podListIndex]
        if (pod) {
          onOpenPod(pod)
        }
      } else if (key.name === "m") {
        onToggleMetric()
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [podListIndex, podScrollOffset, pods.length, maxPodRows, onOpenPod, onBack, onToggleMetric, onQuit],
  )

  useKeyboard(handleKey)

  const commands = useMemo(() => t`${fg("#58A6FF")("[enter]")} pod  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[m]")}etric  ${fg("#58A6FF")("[q]")}uit`, [])

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
        title="PODS"
        borderStyle="single"
        borderColor="#30363D"
        style={{ flexDirection: "column", flexGrow: 1, width: "100%" }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading pod data...")}`} />
            <text fg="#484F58" content={`Fetching pods on ${node.name}...`} />
          </box>
        ) : (
          <PodTable
            pods={pods}
            scrollOffset={podScrollOffset}
            loading={false}
            metricMode={metricMode}
            cpuAllocatable={node.cpuAllocatable}
            memAllocatable={node.memAllocatable}
            selectedIndex={podListIndex}
          />
        )}
      </box>

      <CommandsBar content={commands} />
    </>
  )
}
