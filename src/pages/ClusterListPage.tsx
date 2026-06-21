import { useCallback, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { t, fg } from "@opentui/core"
import { ClusterTable } from "../components/ClusterTable"
import { LegendsBar } from "../components/LegendsBar"
import { SearchBar } from "../components/SearchBar"
import { ContextModal } from "../components/ContextModal"
import type { Cluster, KubeContext, MetricMode } from "../types"

type SortOrder = "none" | "asc" | "desc"

function cycleSort(current: SortOrder): SortOrder {
  if (current === "none") return "asc"
  if (current === "asc") return "desc"
  return "none"
}

function computeDisplay(
  clusters: Cluster[],
  searchQuery: string,
  favorites: Set<string>,
  sortOrder: SortOrder,
): Cluster[] {
  const q = searchQuery.toLowerCase()
  const filtered = q ? clusters.filter((c) => c.name.toLowerCase().includes(q)) : [...clusters]

  const favs = filtered.filter((c) => favorites.has(c.name))
  const rest = filtered.filter((c) => !favorites.has(c.name))

  const sortFn = (a: Cluster, b: Cluster): number => {
    if (sortOrder === "asc") return a.name.localeCompare(b.name)
    if (sortOrder === "desc") return b.name.localeCompare(a.name)
    return 0
  }

  favs.sort(sortFn)
  rest.sort(sortFn)

  return [...favs, ...rest]
}

interface ClusterListPageProps {
  clusters: Cluster[]
  contexts: KubeContext[]
  currentContext: string
  metricMode: MetricMode
  loading: boolean
  spinner: string
  onOpenCluster: (cluster: Cluster) => void
  onSwitchContext: (ctxName: string) => void
  onToggleMetric: () => void
  onQuit: () => void
}

export function ClusterListPage({
  clusters,
  contexts,
  currentContext,
  metricMode,
  loading,
  spinner,
  onOpenCluster,
  onSwitchContext,
  onToggleMetric,
  onQuit,
}: ClusterListPageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sortOrder, setSortOrder] = useState<SortOrder>("none")
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  const [contextModalOpen, setContextModalOpen] = useState(false)
  const [contextSelectIndex, setContextSelectIndex] = useState(0)
  const [contextSearch, setContextSearch] = useState("")
  const [contextSearchCursor, setContextSearchCursor] = useState(0)

  const { width: termWidth, height: termHeight } = useTerminalDimensions()

  const filteredContexts = contexts.filter((c) =>
    c.name.toLowerCase().includes(contextSearch.toLowerCase()),
  )

  const displayed = computeDisplay(clusters, searchQuery, favorites, sortOrder)
  const selectedCluster = displayed[selectedIndex]

  const handleKey = useCallback(
    (key: { name: string; ctrl?: boolean; sequence?: string }) => {
      if (contextModalOpen) {
        if (key.name === "escape") {
          setContextModalOpen(false)
          setContextSearch("")
          setContextSearchCursor(0)
        } else if (key.name === "up") {
          setContextSelectIndex((i: number) => Math.max(0, i - 1))
        } else if (key.name === "down") {
          setContextSelectIndex((i: number) =>
            Math.min(filteredContexts.length - 1, i + 1),
          )
        } else if (key.name === "return") {
          if (filteredContexts.length > 0) {
            const chosen = filteredContexts[contextSelectIndex]
            if (chosen && chosen.name !== currentContext) {
              setContextModalOpen(false)
              setContextSearch("")
              setContextSearchCursor(0)
              onSwitchContext(chosen.name)
            } else {
              setContextModalOpen(false)
              setContextSearch("")
              setContextSearchCursor(0)
            }
          }
        } else if (key.name === "left") {
          setContextSearchCursor((c: number) => Math.max(0, c - 1))
        } else if (key.name === "right") {
          setContextSearchCursor((c: number) =>
            Math.min(contextSearch.length, c + 1),
          )
        } else if (key.name === "home") {
          setContextSearchCursor(0)
        } else if (key.name === "end") {
          setContextSearchCursor(contextSearch.length)
        } else if (key.name === "backspace") {
          if (contextSearchCursor > 0) {
            const before = contextSearch.slice(0, contextSearchCursor - 1)
            const after = contextSearch.slice(contextSearchCursor)
            setContextSearch(before + after)
            setContextSearchCursor((c: number) => c - 1)
            setContextSelectIndex(0)
          }
        } else if (key.name === "delete") {
          if (contextSearchCursor < contextSearch.length) {
            const before = contextSearch.slice(0, contextSearchCursor)
            const after = contextSearch.slice(contextSearchCursor + 1)
            setContextSearch(before + after)
          }
        } else {
          const ch = key.sequence || ""
          if (ch.length === 1 && !key.ctrl) {
            const before = contextSearch.slice(0, contextSearchCursor)
            const after = contextSearch.slice(contextSearchCursor)
            setContextSearch(before + ch + after)
            setContextSearchCursor((c: number) => c + 1)
            setContextSelectIndex(0)
          }
        }
        return
      }

      if (searchMode) {
        if (key.name === "escape") {
          setSearchMode(false)
          setSearchQuery("")
        } else if (key.name === "return") {
          setSearchMode(false)
        }
        return
      }

      if (key.name === "up") {
        setSelectedIndex((i: number) => Math.max(0, i - 1))
      } else if (key.name === "down") {
        setSelectedIndex((i: number) => Math.min(displayed.length - 1, i + 1))
      } else if (key.name === "return") {
        if (selectedCluster) {
          onOpenCluster(selectedCluster)
        }
      } else if (key.name === "q") {
        onQuit()
      } else if (key.name === "s") {
        setSortOrder((prev: SortOrder) => cycleSort(prev))
      } else if (key.name === "/") {
        setSearchMode(true)
        setSearchQuery("")
      } else if (key.name === "f") {
        if (selectedCluster) {
          setFavorites((prev: Set<string>) => {
            const next = new Set(prev)
            if (next.has(selectedCluster.name)) {
              next.delete(selectedCluster.name)
            } else {
              next.add(selectedCluster.name)
            }
            return next
          })
        }
      } else if (key.name === "c") {
        if (contexts.length > 0) {
          const curIdx = contexts.findIndex((c) => c.name === currentContext)
          setContextSelectIndex(curIdx >= 0 ? curIdx : 0)
          setContextSearch("")
          setContextSearchCursor(0)
          setContextModalOpen(true)
        }
      } else if (key.name === "m") {
        onToggleMetric()
      }
    },
    [
      displayed.length,
      selectedCluster,
      searchMode,
      contextModalOpen,
      filteredContexts,
      contextSelectIndex,
      contextSearch,
      contextSearchCursor,
      currentContext,
      contexts,
      onOpenCluster,
      onSwitchContext,
      onToggleMetric,
      onQuit,
    ],
  )

  useKeyboard(handleKey)

  return (
    <>
      {searchMode && (
        <SearchBar query={searchQuery} onInput={setSearchQuery} />
      )}

      <box
        title="CLUSTER"
        borderStyle="single"
        borderColor="#30363D"
        style={{
          flexDirection: "column",
          flexGrow: 1,
          width: "100%",
        }}
      >
        {loading ? (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text content={t`${fg("#D29922")(spinner)} ${fg("#8B949E")("Loading cluster data...")}`} />
            <text fg="#484F58" content={`Connecting to ${currentContext || "cluster"}...`} />
          </box>
        ) : displayed.length > 0 ? (
          <ClusterTable
            clusters={displayed}
            selectedIndex={selectedIndex}
            sortOrder={sortOrder}
            favorites={favorites}
            metricMode={metricMode}
          />
        ) : (
          <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
            <text fg="#8B949E" content="No clusters found" />
            {searchQuery ? (
              <text fg="#484F58" content={`No clusters match "${searchQuery}"`} />
            ) : contexts.length === 0 ? (
              <text fg="#484F58" content="No kubeconfig at ~/.kube/config" />
            ) : (
              <text fg="#484F58" content="No contexts configured" />
            )}
          </box>
        )}
      </box>

      <LegendsBar />

      {contextModalOpen && (
        <ContextModal
          contexts={contexts}
          currentContext={currentContext}
          filteredContexts={filteredContexts}
          selectIndex={contextSelectIndex}
          search={contextSearch}
          searchCursor={contextSearchCursor}
          termWidth={termWidth}
          termHeight={termHeight}
        />
      )}
    </>
  )
}
