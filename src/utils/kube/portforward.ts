import { spawn } from "child_process"
import * as net from "net"

export interface PortForwardHandle {
  abort: () => void
  localPort: number
  containerPort: number
  containerName: string
  podName: string
  namespace: string
  protocol: string
  pid: number
}

export function isLocalPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once("error", () => resolve(true))
    server.once("listening", () => { server.close(); resolve(false) })
    server.listen(port, "127.0.0.1")
  })
}

export async function findFreeLocalPort(startPort: number): Promise<number> {
  let port = startPort
  while (port < 65536) {
    const inUse = await isLocalPortInUse(port)
    if (!inUse) return port
    port++
  }
  return startPort
}

export function startPortForward(opts: {
  contextName: string
  namespace: string
  podName: string
  localPort: number
  containerPort: number
  containerName: string
  protocol: string
}): PortForwardHandle {
  let aborted = false
  let resolvedPid = 0
  const child = spawn("kubectl", [
    "port-forward",
    `--context=${opts.contextName}`,
    `pod/${opts.podName}`,
    `${opts.localPort}:${opts.containerPort}`,
    "-n", opts.namespace,
  ], {
    stdio: ["pipe", "pipe", "pipe"],
  })

  child.on("error", () => {
    aborted = true
  })

  child.stdout.on("data", () => {
    if (aborted) return
  })

  child.stderr.on("data", () => {
    if (aborted) return
  })

  child.on("exit", () => {
    aborted = true
  })

  try {
    resolvedPid = child.pid ?? 0
  } catch {
    resolvedPid = 0
  }

  return {
    abort: () => {
      if (aborted) return
      aborted = true
      try {
        child.kill("SIGTERM")
        setTimeout(() => {
          try { child.kill("SIGKILL") } catch {}
        }, 2000)
      } catch {}
    },
    localPort: opts.localPort,
    containerPort: opts.containerPort,
    containerName: opts.containerName,
    podName: opts.podName,
    namespace: opts.namespace,
    protocol: opts.protocol,
    pid: resolvedPid,
  }
}
