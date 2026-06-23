import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { ClusterOverview } from "../components/ClusterOverview"
import { CommandsBar } from "../components/CommandsBar"
import { NodeTable } from "../components/NodeTable"
import { NamespaceTable } from "../components/NamespaceTable"
import { ResourceTable } from "../components/ResourceTable"
import type { Cluster, NamespaceInfo, ClusterResource, NodeDetail, MetricMode } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type ClusterView = "nodes" | "namespaces" | "resources"

interface ClusterDetailPageProps {
  cluster: Cluster
  nodeDetails: NodeDetail[]
  namespaces: NamespaceInfo[]
  resources: ClusterResource[]
  loading: boolean
  metricMode: MetricMode
  onOpenNode: (node: NodeDetail) => void
  onBack: () => void
  onToggleMetric: () => void
  onQuit: () => void
}

export function ClusterDetailPage({
  cluster,
  nodeDetails,
  namespaces,
  resources,
  loading,
  metricMode,
  onOpenNode,
  onBack,
  onToggleMetric,
  onQuit,
}: ClusterDetailPageProps) {
  const [view, setView] = useState<ClusterView>("nodes")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const [nodeListIndex, setNodeListIndex] = useState(0)
  const [nsListIndex, setNsListIndex] = useState(0)
  const [resourceListIndex, setResourceListIndex] = useState(0)

  const nodeScrollRef = useRef<any>(null)
  const nsScrollRef = useRef<any>(null)
  const resourceScrollRef = useRef<any>(null)

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      return
    }
    spinnerRef.current = setInterval(() => setSpinnerFrame((f: number) => f + 1), 80)
    return () => { if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null } }
  }, [loading])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "1") {
        setView("nodes")
        setNodeListIndex(0)
      } else if (key.name === "2") {
        setView("namespaces")
        setNsListIndex(0)
      } else if (key.name === "3") {
        setView("resources")
        setResourceListIndex(0)
      } else if (key.name === "up") {
        if (view === "nodes") {
          if (nodeListIndex > 0) {
            const newIdx = nodeListIndex - 1
            setNodeListIndex(newIdx)
            scrollIntoView(nodeScrollRef, `node-${newIdx}`)
          }
        } else if (view === "namespaces") {
          if (nsListIndex > 0) {
            const newIdx = nsListIndex - 1
            setNsListIndex(newIdx)
            scrollIntoView(nsScrollRef, `ns-${newIdx}`)
          }
        } else if (view === "resources") {
          if (resourceListIndex > 0) {
            const newIdx = resourceListIndex - 1
            setResourceListIndex(newIdx)
            if (newIdx === 0) {
              resourceScrollRef.current?.scrollTo?.(0)
            } else {
              scrollIntoView(resourceScrollRef, `res-${newIdx}`)
            }
          }
        }
      } else if (key.name === "down") {
        if (view === "nodes") {
          if (nodeListIndex < nodeDetails.length - 1) {
            const newIdx = nodeListIndex + 1
            setNodeListIndex(newIdx)
            scrollIntoView(nodeScrollRef, `node-${newIdx}`)
          }
        } else if (view === "namespaces") {
          if (nsListIndex < namespaces.length - 1) {
            const newIdx = nsListIndex + 1
            setNsListIndex(newIdx)
            scrollIntoView(nsScrollRef, `ns-${newIdx}`)
          }
        } else if (view === "resources") {
          if (resourceListIndex < resources.length - 1) {
            const newIdx = resourceListIndex + 1
            setResourceListIndex(newIdx)
            scrollIntoView(resourceScrollRef, `res-${newIdx}`)
          }
        }
      } else if (key.name === "return") {
        if (view === "nodes") {
          const node = nodeDetails[nodeListIndex]
          if (node) onOpenNode(node)
        }
      } else if (key.name === "m") {
        onToggleMetric()
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [view, nodeListIndex, nodeDetails.length, nsListIndex, namespaces.length, resourceListIndex, resources.length, onOpenNode, onBack, onToggleMetric, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const tabTitle = useMemo(() => {
    if (view === "nodes") return "NODES"
    if (view === "namespaces") return "NAMESPACES"
    return "RESOURCES"
  }, [view])

  const commands = useMemo(() => {
    return t`${fg("#58A6FF")("[1]")} ${fg("#8B949E")("nodes  ")}${fg("#58A6FF")("[2]")} ${fg("#8B949E")("namespaces  ")}${fg("#58A6FF")("[3]")} ${fg("#8B949E")("resources  ")}${fg("#58A6FF")("[m]")} ${fg("#8B949E")("etric  ")}${fg("#58A6FF")("[esc]")} ${fg("#8B949E")("back  ")}${fg("#58A6FF")("[q]")} ${fg("#8B949E")("uit")}`
  }, [])

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
        title={tabTitle}
        borderStyle="single"
        borderColor="#58A6FF"
        style={{ flexDirection: "column", flexGrow: 1, width: "100%" }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading cluster data...")}`} />
            <text fg="#484F58" content={`Fetching from ${cluster.name}...`} />
          </box>
        ) : view === "nodes" ? (
          <NodeTable
            nodes={nodeDetails}
            selectedIndex={nodeListIndex}
            metricMode={metricMode}
            scrollRef={nodeScrollRef}
          />
        ) : view === "namespaces" ? (
          <NamespaceTable
            namespaces={namespaces}
            selectedIndex={nsListIndex}
            scrollRef={nsScrollRef}
          />
        ) : (
          <ResourceTable
            resources={resources}
            selectedIndex={resourceListIndex}
            scrollRef={resourceScrollRef}
          />
        )}
      </box>

      <CommandsBar content={commands} />
    </>
  )
}
