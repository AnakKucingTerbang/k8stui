import { Writable } from "stream"
import * as https from "node:https"
import { KubeConfig } from "@kubernetes/client-node"

export interface StreamLogOptions {
  contextName: string
  podName: string
  namespace: string
  containerName: string
  follow?: boolean
  previous?: boolean
  tailLines?: number
  sinceSeconds?: number
  timestamps?: boolean
  onLine: (line: string) => void
  onError: (err: Error) => void
  onEnd: () => void
}

export interface LogStreamHandle {
  abort: () => void
}

const MAX_BUFFER_LINES = 5000
const RETRY_MAX = 10
const RETRY_BASE_MS = 500
const RETRY_MAX_MS = 5000
const CONNECT_TIMEOUT_MS = 10000

let sharedKubeConfig: KubeConfig | null = null
let sharedKubeContext: string = ""
let sharedHttpsOpts: Record<string, unknown> | null = null
let sharedServer: string = ""

async function getKubeConfig(contextName: string): Promise<{ kc: KubeConfig; httpsOpts: Record<string, unknown>; server: string }> {
  if (sharedKubeConfig && sharedKubeContext === contextName && sharedHttpsOpts && sharedServer) {
    return { kc: sharedKubeConfig, httpsOpts: sharedHttpsOpts, server: sharedServer }
  }
  const kc = new KubeConfig()
  kc.loadFromDefault()
  if (contextName && kc.getCurrentContext() !== contextName) {
    kc.setCurrentContext(contextName)
  }
  const cluster = kc.getCurrentCluster()
  if (!cluster) {
    throw new Error("No active cluster in kubeconfig")
  }
  const httpsOpts: Record<string, unknown> = {}
  await kc.applyToHTTPSOptions(httpsOpts)
  sharedKubeConfig = kc
  sharedKubeContext = contextName
  sharedHttpsOpts = httpsOpts
  sharedServer = cluster.server
  return { kc, httpsOpts, server: cluster.server }
}

class LineSplittingWritable extends Writable {
  private buffer = ""
  private onLine: (line: string) => void
  private onEnd: () => void
  private onError: (err: Error) => void

  constructor(
    onLine: (line: string) => void,
    onEnd: () => void,
    onError: (err: Error) => void,
  ) {
    super()
    this.onLine = onLine
    this.onEnd = onEnd
    this.onError = onError
  }

  override _write(chunk: Buffer | string, _encoding: string, callback: (error?: Error | null) => void) {
    this.buffer += chunk.toString()
    const lines = this.buffer.split("\n")
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i]
      if (line !== undefined && line.length > 0) {
        this.onLine(line)
      }
    }
    this.buffer = lines[lines.length - 1] || ""
    callback()
  }

  override _final(callback: (error?: Error | null) => void) {
    if (this.buffer.length > 0) {
      this.onLine(this.buffer)
      this.buffer = ""
    }
    this.onEnd()
    callback()
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void) {
    if (error) {
      this.onError(error)
      this.onEnd()
    }
    callback()
  }
}

function buildLogURL(server: string, namespace: string, podName: string, containerName: string, opts: {
  follow: boolean
  previous: boolean
  tailLines: number
  sinceSeconds?: number
  timestamps: boolean
}): URL {
  const path = `/api/v1/namespaces/${namespace}/pods/${podName}/log`
  const url = new URL(server + path)
  url.searchParams.set("container", containerName)
  url.searchParams.set("follow", opts.follow.toString())
  url.searchParams.set("previous", opts.previous.toString())
  url.searchParams.set("tailLines", opts.tailLines.toString())
  url.searchParams.set("timestamps", opts.timestamps.toString())
  url.searchParams.set("pretty", "false")
  if (opts.sinceSeconds && opts.sinceSeconds > 0) {
    url.searchParams.set("sinceSeconds", opts.sinceSeconds.toString())
  }
  return url
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function streamPodLogs(opts: StreamLogOptions): LogStreamHandle {
  let aborted = false
  let currentReq: ReturnType<typeof https.request> | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const shouldFollow = opts.follow ?? true
  const isPrevious = opts.previous ?? false
  const tailLines = opts.tailLines ?? 100
  const timestamps = opts.timestamps ?? false

  const retry = async (attempt: number) => {
    if (aborted) return

    try {
      const { httpsOpts, server } = await getKubeConfig(opts.contextName)

      if (aborted) return

      const url = buildLogURL(server, opts.namespace, opts.podName, opts.containerName, {
        follow: shouldFollow,
        previous: isPrevious,
        tailLines,
        sinceSeconds: opts.sinceSeconds,
        timestamps,
      })

      const lineStream = new LineSplittingWritable(
        opts.onLine,
        () => {
          if (!aborted) {
            if (!shouldFollow) {
              opts.onEnd()
              return
            }
            const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS)
            if (attempt < RETRY_MAX) {
              setTimeout(() => retry(attempt + 1), delay)
            } else {
              opts.onEnd()
            }
          }
        },
        (err) => {
          if (!aborted) {
            opts.onError(err)
            if (!shouldFollow) {
              opts.onEnd()
              return
            }
            const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS)
            if (attempt < RETRY_MAX) {
              setTimeout(() => retry(attempt + 1), delay)
            } else {
              opts.onEnd()
            }
          }
        },
      )

      const req = https.request(url, httpsOpts, (res) => {
        if (aborted) {
          res.destroy()
          return
        }

        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        if (res.statusCode !== 200) {
          let body = ""
          res.on("data", (chunk: Buffer) => { body += chunk.toString() })
          res.on("end", () => {
            const msg = body.length > 0 ? body.substring(0, 200) : `HTTP ${res.statusCode}`
            const err = new Error(msg)
            opts.onError(err)
            if (!shouldFollow) {
              opts.onEnd()
              return
            }
            const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS)
            if (attempt < RETRY_MAX) {
              setTimeout(() => retry(attempt + 1), delay)
            } else {
              opts.onEnd()
            }
          })
          return
        }

        res.pipe(lineStream)
      })

      currentReq = req

      req.on("error", (err) => {
        if (aborted) return
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        opts.onError(err)
        if (!shouldFollow) {
          opts.onEnd()
          return
        }
        const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS)
        if (attempt < RETRY_MAX) {
          setTimeout(() => retry(attempt + 1), delay)
        } else {
          opts.onEnd()
        }
      })

      timeoutId = setTimeout(() => {
        if (!aborted) {
          const err = new Error("Log stream connection timed out")
          opts.onError(err)
          req.destroy()
          if (!shouldFollow) {
            opts.onEnd()
          } else {
            const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS)
            if (attempt < RETRY_MAX) {
              setTimeout(() => retry(attempt + 1), delay)
            } else {
              opts.onEnd()
            }
          }
        }
      }, CONNECT_TIMEOUT_MS)

      req.end()
    } catch (err) {
      if (!aborted) {
        const error = err instanceof Error ? err : new Error(String(err))
        opts.onError(error)
        if (!shouldFollow) {
          opts.onEnd()
          return
        }
        const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS)
        if (attempt < RETRY_MAX) {
          await sleep(delay)
          retry(attempt + 1)
        } else {
          opts.onEnd()
        }
      }
    }
  }

  retry(0)

  return {
    abort: () => {
      aborted = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (currentReq) {
        currentReq.destroy()
        currentReq = null
      }
    },
  }
}

export function trimLogBuffer(lines: string[], max = MAX_BUFFER_LINES): string[] {
  if (lines.length <= max) return lines
  return lines.slice(lines.length - max)
}

export interface SinceOption {
  key: string
  label: string
  sinceSeconds?: number
  tailLines?: number
}

export const SINCE_OPTIONS: SinceOption[] = [
  { key: "0", label: "LIVE", sinceSeconds: undefined, tailLines: 100 },
  { key: "1", label: "5m", sinceSeconds: 300 },
  { key: "2", label: "30m", sinceSeconds: 1800 },
  { key: "3", label: "3h", sinceSeconds: 10800 },
]

export function getSinceOption(key: string): SinceOption | undefined {
  return SINCE_OPTIONS.find((s) => s.key === key)
}
