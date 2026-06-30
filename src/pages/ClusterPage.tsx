import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { Section } from "../components/Section"
import { Panel } from "../components/Panel"
import { ClusterOverview } from "../components/ClusterOverview"
import { CommandsBar, type CommandItem } from "../components/CommandsBar"
import { NodeTable } from "../components/NodeTable"
import { NamespaceTable } from "../components/NamespaceTable"
import { ResourceTable } from "../components/ResourceTable"
import { CustomResourceTable } from "../components/CustomResourceTable"
import type { Cluster, NamespaceInfo, ClusterResource, NodeDetail, MetricMode, ResourceCategory, CustomGroup, NamespacedResource } from "../types"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type ClusterView = "nodes" | "namespaces" | "resources"
type LeftMode = "views" | "custom"
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

function buildCustomResourceRowMap(resources: NamespacedResource[]) {
  const grouped = new Map<string, NamespacedResource[]>()
  for (const r of resources) {
    const list = grouped.get(r.kind) || []
    list.push(r)
    grouped.set(r.kind, list)
  }
  const itemToRow: number[] = []
  const rowToItem = new Map<number, number>()
  let row = 0
  let idx = 0
  for (const kind of [...grouped.keys()].sort()) {
    const items = grouped.get(kind)
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
  customGroups: CustomGroup[]
  customResourceMap: Record<string, NamespacedResource[]>
  customLoading: boolean
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
  customGroups,
  customResourceMap,
  customLoading,
  onOpenNode,
  onOpenNamespace,
  onOpenResource,
  onBack,
  onToggleMetric,
  onQuit,
}: ClusterDetailPageProps) {
  const [leftIndex, setLeftIndex] = useState(0)
  const [leftMode, setLeftMode] = useState<LeftMode>("views")
  const [focus, setFocus] = useState<Focus>("left")
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  const [nodeListIndex, setNodeListIndex] = useState(0)
  const [nsListIndex, setNsListIndex] = useState(0)
  const [resourceListIndex, setResourceListIndex] = useState(0)
  const [customGroupIndex, setCustomGroupIndex] = useState(0)
  const [customResIndex, setCustomResIndex] = useState(0)

  const nodeScrollRef = useRef<any>(null)
  const nsScrollRef = useRef<any>(null)
  const resourceScrollRef = useRef<any>(null)
  const customResScrollRef = useRef<any>(null)

  const activeView = LEFT_VIEWS[leftIndex]!

  const visibleGroups = useMemo(() => {
    return customGroups.filter((g) => (customResourceMap[g.apiGroup.groupVersion]?.length ?? 0) > 0)
  }, [customGroups, customResourceMap])

  const activeCustomResources = useMemo(() => {
    if (visibleGroups.length === 0) return []
    const group = visibleGroups[customGroupIndex]
    if (!group) return []
    return customResourceMap[group.apiGroup.groupVersion] || []
  }, [visibleGroups, customGroupIndex, customResourceMap])

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

  useEffect(() => {
    setCustomGroupIndex(0)
  }, [visibleGroups.length])

  useEffect(() => {
    setCustomResIndex(0)
  }, [activeCustomResources])

  const scrollIntoView = useCallback((scrollRef: React.RefObject<any>, id: string) => {
    scrollRef.current?.scrollChildIntoView?.(id)
  }, [])

  const handleKey = useCallback(
    (key: { name: string }) => {
      if (key.name === "escape") {
        onBack()
      } else if (key.name === "tab") {
        if (focus === "left" && visibleGroups.length > 0) {
          setLeftMode((prev) => prev === "views" ? "custom" : "views")
        }
      } else if (key.name === "up") {
        if (focus === "left") {
          if (leftMode === "views") {
            if (leftIndex > 0) setLeftIndex((i) => i - 1)
          } else {
            if (customGroupIndex > 0) setCustomGroupIndex((i) => i - 1)
          }
        } else if (leftMode === "custom") {
          const vis = getViewportBounds(customResScrollRef)
          const { itemToRow, rowToItem } = buildCustomResourceRowMap(activeCustomResources)
          let idx = customResIndex
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
            setCustomResIndex(newIdx)
            if (newIdx === 0) customResScrollRef.current?.scrollTo?.(0)
            else scrollIntoView(customResScrollRef, `cres-${newIdx}`)
          }
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
            if (newIdx === 0) resourceScrollRef.current?.scrollTo?.(0)
            else scrollIntoView(resourceScrollRef, `res-${newIdx}`)
          }
        }
      } else if (key.name === "down") {
        if (focus === "left") {
          if (leftMode === "views") {
            if (leftIndex < LEFT_VIEWS.length - 1) setLeftIndex((i) => i + 1)
          } else {
            if (customGroupIndex < visibleGroups.length - 1) setCustomGroupIndex((i) => i + 1)
          }
        } else if (leftMode === "custom") {
          const vis = getViewportBounds(customResScrollRef)
          const { itemToRow, rowToItem } = buildCustomResourceRowMap(activeCustomResources)
          let idx = customResIndex
          const currentRow = itemToRow[idx] ?? 0
          if (vis && (currentRow < vis.first || currentRow > vis.last)) {
            let firstVisible = Infinity
            for (const [row, item] of rowToItem) {
              if (row >= vis.first && row <= vis.last && item < firstVisible) firstVisible = item
            }
            if (firstVisible < Infinity) idx = firstVisible
          }
          if (idx < activeCustomResources.length - 1) {
            const newIdx = idx + 1
            setCustomResIndex(newIdx)
            scrollIntoView(customResScrollRef, `cres-${newIdx}`)
          }
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
          if (leftMode === "custom") {
            const res = activeCustomResources[customResIndex]
            if (res) onOpenResource({ kind: res.kind, name: res.name, namespace: res.namespace, category: "configuration" })
          } else if (activeView === "nodes") {
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
    [focus, leftMode, leftIndex, activeView, nodeListIndex, nodeDetails.length, nsListIndex, namespaces.length, resourceListIndex, resources, customGroupIndex, customResIndex, visibleGroups, activeCustomResources, onOpenNode, onOpenNamespace, onOpenResource, onBack, onToggleMetric, onQuit, scrollIntoView],
  )

  useKeyboard(handleKey)

  const rightTitle = useMemo(() => {
    if (leftMode === "custom") {
      if (visibleGroups.length === 0) return "CUSTOM"
      const group = visibleGroups[customGroupIndex]
      if (!group) return "CUSTOM"
      return group.apiGroup.name.toUpperCase()
    }
    return VIEW_TITLES[activeView]
  }, [leftMode, visibleGroups, customGroupIndex, activeView])

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
      ...(visibleGroups.length > 0 ? [{ key: "[tab]", label: leftMode === "views" ? "custom" : "views" }] : []),
      { key: "[→]", label: "details" },
      { key: "[m]", label: "etric" },
      { key: "[esc]", label: "back" },
      { key: "[q]", label: "uit" },
    ]
  }, [focus, leftMode, visibleGroups.length])

  const renderRightContent = () => {
    if (leftMode === "custom") {
      if (customLoading) {
        return (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading custom resources...")}`} />
          </box>
        )
      }
      if (visibleGroups.length === 0) {
        return (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#484F58")("No custom resources found")}`} />
          </box>
        )
      }
      return <CustomResourceTable resources={activeCustomResources} selectedIndex={customResIndex} scrollRef={customResScrollRef} />
    }

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
      <Section title="OVERVIEW" height={7}>
        <ClusterOverview cluster={cluster} metricMode={metricMode} />
      </Section>

      <box style={{ flexDirection: "row", flexGrow: 1, width: "100%", gap: 0 }}>
        <box style={{ flexDirection: "column", width: 20, gap: 0 }}>
          <Panel title="VIEWS" focused={focus === "left" && leftMode === "views"} width={20} gap={0}>
            {LEFT_VIEWS.map((view, i) => {
              const isSelected = leftMode === "views" && i === leftIndex
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

          <Panel title="CUSTOM" focused={focus === "left" && leftMode === "custom"} width={20} gap={0}>
            {visibleGroups.length === 0 ? (
              <box style={{ height: 1, width: "100%" }}>
                <text content={t`${fg("#484F58")(" No custom resources")}`} />
              </box>
            ) : (
              visibleGroups.map((group, i) => {
                const isSelected = leftMode === "custom" && i === customGroupIndex
                const bgColor = isSelected ? "#1A3A5C" : undefined
                const textColor = isSelected ? "#E6EDF3" : "#8B949E"
                const label = group.apiGroup.name
                const count = customResourceMap[group.apiGroup.groupVersion]?.length ?? 0
                return (
                  <box key={group.apiGroup.groupVersion} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                    <text content={t`${fg(textColor)(` ${label}`)} ${fg("#484F58")(`(${count})`)}`} />
                  </box>
                )
              })
            )}
          </Panel>
        </box>

        <Panel title={rightTitle} focused={focus === "right"} flexGrow={1} gap={0}>
          {renderRightContent()}
        </Panel>
      </box>

      <CommandsBar commands={commands} />
    </>
  )
}
