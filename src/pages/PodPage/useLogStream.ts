import { useCallback, useEffect, useRef, useState } from "react"
import { streamPodLogs, trimLogBuffer, getSinceOption, type LogStreamHandle } from "../../utils/kube-logs"
import type { PodDetail, PodDetailFull } from "../../types"
import type { LeftBox } from "./types"

interface UseLogStreamArgs {
  pod: PodDetail
  podDetailFull: PodDetailFull | null
  containerIndex: number
  lastLeftBox: LeftBox
  logsSinceKey: string
  logsPrevious: boolean
  contextName: string
  onToast: (msg: string) => void
}

export function useLogStream({
  pod,
  podDetailFull,
  containerIndex,
  lastLeftBox,
  logsSinceKey,
  logsPrevious,
  contextName,
  onToast,
}: UseLogStreamArgs) {
  const [logs, setLogs] = useState<string[]>([])
  const [logsStreaming, setLogsStreaming] = useState(false)
  const logStreamRef = useRef<LogStreamHandle | null>(null)

  const startLogStream = useCallback((containerName: string, sinceKey: string, previous: boolean) => {
    if (logStreamRef.current) {
      logStreamRef.current.abort()
      logStreamRef.current = null
    }

    const since = getSinceOption(sinceKey)
    if (!since || !containerName || !contextName || !pod.name || !pod.namespace) {
      setLogsStreaming(false)
      return
    }

    setLogsStreaming(true)
    setLogs([])

    const opts: import("../../utils/kube-logs").StreamLogOptions = {
      contextName,
      podName: pod.name,
      namespace: pod.namespace,
      containerName,
      follow: !previous,
      previous,
      tailLines: since.tailLines ?? 100,
      sinceSeconds: since.sinceSeconds,
      timestamps: true,
      onLine: (line: string) => {
        setLogs((prev) => trimLogBuffer([...prev, line]))
      },
      onError: (err: Error) => {
        onToast(`Log error: ${err.message}`)
      },
      onEnd: () => {
        setLogsStreaming(false)
      },
    }

    logStreamRef.current = streamPodLogs(opts)
  }, [contextName, pod.name, pod.namespace, onToast])

  useEffect(() => {
    const containerName = podDetailFull?.containers[containerIndex]?.name
    if (lastLeftBox === "logs" && containerName) {
      startLogStream(containerName, logsSinceKey, logsPrevious)
    }
    if (lastLeftBox !== "logs" && logStreamRef.current) {
      logStreamRef.current.abort()
      logStreamRef.current = null
      setLogsStreaming(false)
    }
  }, [containerIndex, lastLeftBox, podDetailFull?.containers, logsSinceKey, logsPrevious, startLogStream])

  useEffect(() => {
    return () => {
      if (logStreamRef.current) {
        logStreamRef.current.abort()
        logStreamRef.current = null
      }
    }
  }, [])

  return { logs, logsStreaming, setLogsStreaming }
}
