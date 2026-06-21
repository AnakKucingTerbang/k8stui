import { useCallback, useMemo, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { ClusterOverview } from "../components/ClusterOverview"
import { CommandsBar } from "../components/CommandsBar"
import { NodeTable } from "../components/NodeTable"
import type { Cluster, NodeDetail, MetricMode } from "../types"

interface ClusterDetailPageProps {
  cluster: Cluster
  nodeDetails: NodeDetail[]
  loading: boolean
  spinner: string
  metricMode: MetricMode
  onOpenNode: (node: NodeDetail) => void
  onBack: () => void
  onToggleMetric: () => void
  onQuit: () => void
}

export function ClusterDetailPage({
  cluster,
  nodeDetails,
  loading,
  spinner,
  metricMode,
  onOpenNode,
  onBack,
  onToggleMetric,
  onQuit,
}: ClusterDetailPageProps) {
  const [nodeListIndex, setNodeListIndex] = useState(0)
  const [nodeScrollOffset, setNodeScrollOffset] = useState(0)

  const { height: termHeight } = useTerminalDimensions()
  const maxNodeRows = Math.max(1, termHeight - 20)

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "up") {
        if (nodeListIndex > 0) {
          setNodeListIndex((i: number) => i - 1)
          if (nodeListIndex <= nodeScrollOffset) {
            setNodeScrollOffset((i: number) => Math.max(0, i - 1))
          }
        }
      } else if (key.name === "down") {
        if (nodeListIndex < nodeDetails.length - 1) {
          setNodeListIndex((i: number) => i + 1)
          if (nodeListIndex >= nodeScrollOffset + maxNodeRows - 1) {
            setNodeScrollOffset((i: number) => i + 1)
          }
        }
      } else if (key.name === "return") {
        const node = nodeDetails[nodeListIndex]
        if (node) {
          onOpenNode(node)
        }
      } else if (key.name === "m") {
        onToggleMetric()
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [nodeListIndex, nodeScrollOffset, nodeDetails.length, maxNodeRows, onOpenNode, onBack, onToggleMetric, onQuit],
  )

  useKeyboard(handleKey)

  const commands = useMemo(() => t`${fg("#58A6FF")("[enter]")} node  ${fg("#58A6FF")("[esc]")} back  ${fg("#58A6FF")("[m]")}etric  ${fg("#58A6FF")("[q]")}uit`, [])

  const visibleNodes = nodeDetails.slice(nodeScrollOffset, nodeScrollOffset + maxNodeRows)

  return (
    <>
      <box
        title="OVERVIEW"
        borderStyle="single"
        borderColor="#30363D"
        style={{ flexDirection: "column", height: 7, width: "100%" }}
      >
        <ClusterOverview cluster={cluster} metricMode={metricMode} />
      </box>
      <box
        title="NODES"
        borderStyle="single"
        borderColor="#30363D"
        style={{ flexDirection: "column", flexGrow: 1, width: "100%" }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading node data...")}`} />
          </box>
        ) : (
          <NodeTable
            nodes={visibleNodes}
            selectedIndex={nodeListIndex}
            scrollOffset={nodeScrollOffset}
            metricMode={metricMode}
          />
        )}
      </box>

      <CommandsBar content={commands} />
    </>
  )
}
