import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { ClusterOverview } from "../components/ClusterOverview"
import { CommandsBar, type CommandItem } from "../components/CommandsBar"
import { NodeTable } from "../components/NodeTable"
import { NamespaceTable } from "../components/NamespaceTable"
import { ResourceTable } from "../components/ResourceTable"
import type { Cluster, NamespaceInfo, ClusterResource, NodeDetail, MetricMode, ResourceCategory } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type ClusterView = "nodes" | "namespaces" | "resources"
type Focus = "left" | "right"

const LEFT_VIEWS: ClusterView[] = ["nodes", "namespaces", "resources"]
const VIEW_LABELS: Record<ClusterView, string> = {
  nodes: "Nodes",
  namespaces: "Namespaces",
  resources: "Resources",
}
const VIEW_TITLES: Record<ClusterView, string> = {
  nodes: "NODES",
  namespaces: "NAMESPACES",
  resources: "RESOURCES",
}

const RESOURCE_CATEGORY_ORDER: ResourceCategory[] = ["workloads", "network", "storage", "configuration"]

function buildResourceRowMap(resources: ClusterResource[]) {
  const grouped = new Map<ResourceCategory, ClusterResource[]>()
  for (const r of resources) {
    const list = grouped.get(r.category) || []
    list.push(r)
    grouped.set(r.category, list)
  }
  const itemToRow: number[] = []
  const rowToItem = new Map<number, number>()
  let row = 0
  let idx = 0
  for (const cat of RESOURCE_CATEGORY_ORDER) {
    const items = grouped.get(cat)
    if (!items || items.length === 0) continue
    row++
    for (let i = 0; i < items.length; i++) {
      itemToRow[idx] = row
      rowToItem.set(row, idx)
      row++
      idx++
    }
  }
  return { itemToRow, rowToItem }
}

function getViewportBounds(scrollRef: React.RefObject<any>): { first: number; last: number } | null {
  const scroll = scrollRef.current
  if (!scroll) return null
  const top = Math.floor(scroll.scrollTop ?? 0)
  const h = scroll.viewport?.measuredHeight ?? scroll.viewport?.height ?? scroll.height ?? scroll.measuredHeight ?? 20
  return { first: top, last: Math.max(top, top + h - 1) }
}

interface ClusterDetailPageProps {
  cluster: Cluster
  nodeDetails: NodeDetail[]
  namespaces: NamespaceInfo[]
  resources: ClusterResource[]
  loading: boolean
  metricMode: MetricMode
  onOpenNode: (node: NodeDetail) => void
  onOpenNamespace: (namespace: string) => void
  onOpenResource: (resource: ClusterResource) => void
  onBack: () => void
  onToggleMetric: () => void
  onQuit: () => void
}

export function ClusterPage({
  cluster,
  nodeDetails,
  namespaces,
  resources,
  loading,
  metricMode,
  onOpenNode,
  onOpenNamespace,
  onOpenResource,
  onBack,
  onToggleMetric,
  onQuit,
}: ClusterDetailPageProps) {
  const [leftIndex, setLeftIndex] = useState(0)
  const [focus, setFocus] = useState<Focus>("left")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const [nodeListIndex, setNodeListIndex] = useState(0)
  const [nsListIndex, setNsListIndex] = useState(0)
  const [resourceListIndex, setResourceListIndex] = useState(0)

  const nodeScrollRef = useRef<any>(null)
  const nsScrollRef = useRef<any>(null)
  const resourceScrollRef = useRef<any>(null)

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
    setNodeListIndex(0)
    setNsListIndex(0)
    setResourceListIndex(0)
  }, [leftIndex])

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
        } else if (activeView === "nodes") {
          const vis = getViewportBounds(nodeScrollRef)
          let idx = nodeListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.min(vis.last, nodeDetails.length - 1)
          }
          if (idx > 0) {
            const newIdx = idx - 1
            setNodeListIndex(newIdx)
            scrollIntoView(nodeScrollRef, `node-${newIdx}`)
          }
        } else if (activeView === "namespaces") {
          const vis = getViewportBounds(nsScrollRef)
          let idx = nsListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.min(vis.last, namespaces.length - 1)
          }
          if (idx > 0) {
            const newIdx = idx - 1
            setNsListIndex(newIdx)
            scrollIntoView(nsScrollRef, `ns-${newIdx}`)
          }
        } else if (activeView === "resources") {
          const vis = getViewportBounds(resourceScrollRef)
          const { itemToRow, rowToItem } = buildResourceRowMap(resources)
          let idx = resourceListIndex
          const currentRow = itemToRow[idx] ?? 0
          if (vis && (currentRow < vis.first || currentRow > vis.last)) {
            let lastVisible = -1
            for (const [row, item] of rowToItem) {
              if (row >= vis.first && row <= vis.last) lastVisible = Math.max(lastVisible, item)
            }
            if (lastVisible >= 0) idx = lastVisible
          }
          if (idx > 0) {
            const newIdx = idx - 1
            setResourceListIndex(newIdx)
            if (newIdx === 0) {
              resourceScrollRef.current?.scrollTo?.(0)
            } else {
              scrollIntoView(resourceScrollRef, `res-${newIdx}`)
            }
          }
        }
      } else if (key.name === "down") {
        if (focus === "left") {
          if (leftIndex < LEFT_VIEWS.length - 1) setLeftIndex((i) => i + 1)
        } else if (activeView === "nodes") {
          const vis = getViewportBounds(nodeScrollRef)
          let idx = nodeListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.max(vis.first, 0)
          }
          if (idx < nodeDetails.length - 1) {
            const newIdx = idx + 1
            setNodeListIndex(newIdx)
            scrollIntoView(nodeScrollRef, `node-${newIdx}`)
          }
        } else if (activeView === "namespaces") {
          const vis = getViewportBounds(nsScrollRef)
          let idx = nsListIndex
          if (vis && (idx < vis.first || idx > vis.last)) {
            idx = Math.max(vis.first, 0)
          }
          if (idx < namespaces.length - 1) {
            const newIdx = idx + 1
            setNsListIndex(newIdx)
            scrollIntoView(nsScrollRef, `ns-${newIdx}`)
          }
        } else if (activeView === "resources") {
          const vis = getViewportBounds(resourceScrollRef)
          const { itemToRow, rowToItem } = buildResourceRowMap(resources)
          let idx = resourceListIndex
          const currentRow = itemToRow[idx] ?? 0
          if (vis && (currentRow < vis.first || currentRow > vis.last)) {
            let firstVisible = Infinity
            for (const [row, item] of rowToItem) {
              if (row >= vis.first && row <= vis.last && item < firstVisible) firstVisible = item
            }
            if (firstVisible < Infinity) idx = firstVisible
          }
          if (idx < resources.length - 1) {
            const newIdx = idx + 1
            setResourceListIndex(newIdx)
            scrollIntoView(resourceScrollRef, `res-${newIdx}`)
          }
        }
      } else if (key.name === "right") {
        if (focus === "left") setFocus("right")
      } else if (key.name === "left") {
        if (focus === "right") setFocus("left")
      } else if (key.name === "return") {
        if (focus === "right") {
          if (activeView === "nodes") {
            const node = nodeDetails[nodeListIndex]
            if (node) onOpenNode(node)
          } else if (activeView === "namespaces") {
            const ns = namespaces[nsListIndex]
            if (ns) onOpenNamespace(ns.name)
          } else if (activeView === "resources") {
            const res = resources[resourceListIndex]
            if (res) onOpenResource(res)
          }
        }
      } else if (key.name === "m") {
        onToggleMetric()
      } else if (key.name === "q") {
        onQuit()
      }
    },
    [focus, leftIndex, activeView, nodeListIndex, nodeDetails.length, nsListIndex, namespaces.length, resourceListIndex, resources, onOpenNode, onOpenNamespace, onOpenResource, onBack, onToggleMetric, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const leftBorderColor = focus === "left" ? "#58A6FF" : "#30363D"
  const rightBorderColor = focus === "right" ? "#58A6FF" : "#30363D"

  const rightTitle = useMemo(() => VIEW_TITLES[activeView], [activeView])

  const commands = useMemo<CommandItem[]>(() => {
    if (focus === "right") {
      return [
        { key: "[←→]", label: "focus" },
        { key: "[↑↓]", label: "nav" },
        { key: "[enter]", label: "open" },
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
  }, [focus])

  const renderRightContent = () => {
    if (loading) {
      return (
        <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading cluster data...")}`} />
          <text fg="#484F58" content={`Fetching from ${cluster.name}...`} />
        </box>
      )
    }

    if (activeView === "nodes") {
      return (
        <NodeTable
          nodes={nodeDetails}
          selectedIndex={nodeListIndex}
          metricMode={metricMode}
          scrollRef={nodeScrollRef}
        />
      )
    }

    if (activeView === "namespaces") {
      return (
        <NamespaceTable
          namespaces={namespaces}
          selectedIndex={nsListIndex}
          scrollRef={nsScrollRef}
        />
      )
    }

    return (
      <ResourceTable
        resources={resources}
        selectedIndex={resourceListIndex}
        scrollRef={resourceScrollRef}
      />
    )
  }

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

      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <box
          title="VIEWS"
          borderStyle="single"
          borderColor={leftBorderColor}
          style={{ flexDirection: "column", width: 20, gap: 0 }}
        >
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

      <CommandsBar commands={commands} />
    </>
  )
}
