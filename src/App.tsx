import { useCallback, useEffect, useRef, useState } from "react"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react"
import { t, fg, bold } from "@opentui/core"
import type { CliRenderer } from "@opentui/core"
import { ClusterTable } from "./ClusterTable"
import { loadContextsAsync, getCurrentContext, switchContext, fetchClusterStatusAsync } from "./kube"
import type { Cluster, KubeContext } from "./types"

type SortOrder = "none" | "asc" | "desc"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const s = date.getSeconds()
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ampm}`
}

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

interface AppProps {
  renderer: CliRenderer
}

export function App({ renderer }: AppProps) {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [clock, setClock] = useState(formatTime(new Date()))
  const [sortOrder, setSortOrder] = useState<SortOrder>("none")
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [favorites, setFavorites] = useState<Set<string>>(new Set())

  const [contexts, setContexts] = useState<KubeContext[]>([])
  const [currentContext, setCurrentContext] = useState("")
  const [contextModalOpen, setContextModalOpen] = useState(false)
  const [contextSelectIndex, setContextSelectIndex] = useState(0)
  const [contextSearch, setContextSearch] = useState("")
  const [contextSearchCursor, setContextSearchCursor] = useState(0)

  const [loading, setLoading] = useState(true)
  const [spinnerFrame, setSpinnerFrame] = useState(0)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { width: termWidth, height: termHeight } = useTerminalDimensions()

  const filteredContexts = contexts.filter((c) =>
    c.name.toLowerCase().includes(contextSearch.toLowerCase()),
  )

  const displayed = computeDisplay(clusters, searchQuery, favorites, sortOrder)
  const selectedCluster = displayed[selectedIndex]

  const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length] ?? "⠋"

  useEffect(() => {
    if (!loading) {
      if (spinnerRef.current) {
        clearInterval(spinnerRef.current)
        spinnerRef.current = null
      }
      return
    }
    spinnerRef.current = setInterval(() => {
      setSpinnerFrame((f: number) => f + 1)
    }, 80)
    return () => {
      if (spinnerRef.current) {
        clearInterval(spinnerRef.current)
        spinnerRef.current = null
      }
    }
  }, [loading])

  const refreshCluster = useCallback(async () => {
    const data = await fetchClusterStatusAsync(currentContext)
    setClusters([data])
  }, [currentContext])

  const doContextSwitch = useCallback(async (ctxName: string) => {
    setLoading(true)
    switchContext(ctxName)
    setCurrentContext(ctxName)
    const data = await fetchClusterStatusAsync(ctxName)
    setClusters([data])
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      const ctxs = await loadContextsAsync()
      const cur = getCurrentContext()
      setContexts(ctxs)
      setCurrentContext(cur)

      if (cur) {
        const data = await fetchClusterStatusAsync(cur)
        setClusters([data])
        const idx = ctxs.findIndex((c) => c.name === cur)
        setContextSelectIndex(idx >= 0 ? idx : 0)
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!currentContext) return

    refreshCluster()

    pollRef.current = setInterval(refreshCluster, 5000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [currentContext, refreshCluster])

  useEffect(() => {
    renderer.requestLive()

    const clockInterval = setInterval(() => {
      setClock(formatTime(new Date()))
    }, 2000)

    return () => {
      clearInterval(clockInterval)
      renderer.dropLive()
    }
  }, [renderer])

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery, sortOrder])

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
              doContextSwitch(chosen.name)
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
      } else if (key.name === "q") {
        renderer.destroy()
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
      doContextSwitch,
      renderer,
    ],
  )

  useKeyboard(handleKey)

  const modalWidth = 52
  const modalHeight = 10
  const modalLeft = Math.floor((termWidth - modalWidth) / 2)
  const modalTop = Math.floor((termHeight - modalHeight) / 2)

  const maxVisible = 5
  const scrollOffset = Math.max(
    0,
    Math.min(contextSelectIndex, filteredContexts.length - maxVisible),
  )
  const visibleContexts = filteredContexts.slice(scrollOffset, scrollOffset + maxVisible)

  const searchBeforeCursor = contextSearch.slice(0, contextSearchCursor)
  const searchAtCursor = contextSearch.slice(contextSearchCursor, contextSearchCursor + 1)
  const searchAfterCursor = contextSearch.slice(contextSearchCursor + 1)
  const searchDisplay = t`${fg("#58A6FF")("filter: ")}${fg("#E6EDF3")(searchBeforeCursor)}${fg("#58A6FF")(searchAtCursor || "█")}${fg("#E6EDF3")(searchAfterCursor)}`

  const headerContent = loading
    ? t`${fg("#8B949E")("k8s manager")}${fg("#484F58")(" | ")}${fg("#58A6FF")("context:")}${fg("#8B949E")(` ${currentContext} `)}${fg("#D29922")(spinner)}`
    : t`${fg("#8B949E")("k8s manager")}${fg("#484F58")(" | ")}${fg("#58A6FF")("context:")}${fg("#8B949E")(` ${currentContext}`)}`

  return (
    <box style={{ flexDirection: "column", width: "100%", height: "100%", gap: 0 }}>
      <box
        title="K8STUI"
        borderStyle="single"
        borderColor="#30363D"
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          height: 3,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg="#8B949E" content={headerContent} />
        <text fg="#8B949E" content={clock} />
      </box>

      {searchMode && (
        <box
          title="SEARCH"
          borderStyle="single"
          borderColor="#30363D"
          style={{
            flexDirection: "row",
            height: 3,
            paddingLeft: 1,
            alignItems: "center",
            backgroundColor: "#0D1117",
          }}
        >
          <text content={t`${fg("#58A6FF")("search:")} `} />
          <input
            value={searchQuery}
            onInput={setSearchQuery}
            focused={true}
            width={50}
            backgroundColor="#0D1117"
            textColor="#E6EDF3"
            cursorColor="#58A6FF"
          />
        </box>
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

      <box
        title="LEGENDS"
        borderStyle="single"
        borderColor="#30363D"
        style={{
          flexDirection: "row",
          gap: 2,
          height: 3,
          paddingLeft: 1,
          alignItems: "center",
        }}
      >
        <text content={t`${fg("#3FB950")("●")} connected`} fg="#8B949E" />
        <text content={t`${fg("#D29922")("▲")} degraded`} fg="#8B949E" />
        <text content={t`${fg("#F85149")("○")} unreachable`} fg="#8B949E" />
      </box>

      <box
        title="COMMANDS"
        borderStyle="single"
        borderColor="#30363D"
        style={{
          flexDirection: "row",
          height: 3,
          paddingLeft: 1,
          alignItems: "center",
        }}
      >
        <text
          fg="#8B949E"
          content={t`${fg("#58A6FF")("[enter]")} open  ${fg("#58A6FF")("[s]")}ort  ${fg("#58A6FF")("[/]")}find  ${fg("#58A6FF")("[f]")}avorite  ${fg("#58A6FF")("[c]")}ontext  ${fg("#58A6FF")("[q]")}uit`}
        />
      </box>

      {contextModalOpen && (
        <box
          title="SWITCH CONTEXT"
          borderStyle="single"
          borderColor="#58A6FF"
          style={{
            position: "absolute",
            top: modalTop,
            left: modalLeft,
            width: modalWidth,
            height: modalHeight,
            flexDirection: "column",
            zIndex: 100,
            backgroundColor: "#0D1117",
            paddingLeft: 1,
            paddingTop: 1,
          }}
        >
          <box style={{ height: 1, width: "100%" }}>
            <text content={searchDisplay} />
          </box>
          <box style={{ height: 1, width: "100%" }}>
            <text fg="#30363D" content={pad("", modalWidth - 4).replace(/ /g, "─")} />
          </box>
          {filteredContexts.length === 0 ? (
            <box style={{ height: 1, width: "100%" }}>
              <text fg="#484F58" content="No matching contexts" />
            </box>
          ) : (
            visibleContexts.map((ctx, vi) => {
              const realIndex = scrollOffset + vi
              const isSelected = realIndex === contextSelectIndex
              const isCurrent = ctx.name === currentContext
              const bgColor = isSelected ? "#1A3A5C" : undefined
              const textColor = isSelected ? "#E6EDF3" : "#8B949E"
              const prefix = isCurrent ? fg("#3FB950")("● ") : "  "
              const server = ctx.server.replace(/^https?:\/\//, "").substring(0, 24)

              return (
                <box key={ctx.name} style={{ height: 1, width: "100%", backgroundColor: bgColor }}>
                  <text fg={textColor} content={t`${prefix}${pad(ctx.name, 20)}${fg("#484F58")(server)}`} />
                </box>
              )
            })
          )}
          {Array.from({ length: maxVisible - (filteredContexts.length === 0 ? 1 : visibleContexts.length) }, (_, i) => (
            <box key={`empty-${i}`} style={{ height: 1, width: "100%" }}>
              <text content="" />
            </box>
          ))}
          <box style={{ height: 1, width: "100%" }}>
            <text fg="#58A6FF" content={`${filteredContexts.length} of ${contexts.length} contexts`} />
          </box>
        </box>
      )}
    </box>
  )
}

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length)
}
