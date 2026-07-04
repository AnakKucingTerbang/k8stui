import type { DetailRow, ResourceCategory, PodDetail, NamespacedResource, NodeCondition } from "../../types"

export const DASH = "──"

export const RESTARTABLE_KINDS = new Set(["Deployment", "DaemonSet", "StatefulSet"])
export const TRIGGERABLE_KINDS = new Set(["CronJob"])

export function val(s: string): string {
  return s || DASH
}

export function formatAge(ts: string): string {
  const created = new Date(ts).getTime()
  const now = Date.now()
  const diffMs = now - created
  if (diffMs < 0) return "0s"
  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

export function parsePodStatus(pod: any): string {
  if (pod.metadata?.deletionTimestamp) return "Terminating"
  const phase = pod.status?.phase || "Unknown"
  if (phase !== "Running" && phase !== "Pending") return phase
  const containerStatuses = pod.status?.containerStatuses || []
  for (const cs of containerStatuses) {
    const state = cs.state || {}
    if (state.waiting) {
      const reason = state.waiting.reason || ""
      if (reason === "ContainerCreating") return "ContainerCreating"
      if (reason === "CrashLoopBackOff") return "CrashLoopBackOff"
      if (reason === "ImagePullBackOff") return "ImagePullBackOff"
      if (reason !== "") return reason
    }
    if (state.terminated) {
      const reason = state.terminated.reason || ""
      if (reason === "Completed" || reason === "Error") return reason
      if (reason !== "") return reason
    }
  }
  return phase
}

export function parseProbe(probe: any): string {
  if (!probe) return "──"
  if (probe.httpGet) {
    const port = probe.httpGet.port || ""
    const path = probe.httpGet.path || "/"
    return `HTTP GET ${port}${path}`
  }
  if (probe.tcpSocket) {
    const port = probe.tcpSocket.port || ""
    return `TCP ${port}`
  }
  if (probe.exec) {
    const cmd = (probe.exec.command || []).join(" ")
    return `Exec [${cmd}]`
  }
  return "──"
}

interface NodeMetrics {
  cpuPct: number
  memPct: number
  cpu: string
  mem: string
}

export function parseNodesJson(json: string): { total: number; ready: number; down: number } {
  try {
    const data = JSON.parse(json)
    const items = data.items || []
    let ready = 0
    const total = items.length
    for (const node of items) {
      const conditions = node.status?.conditions || []
      const readyCond = conditions.find((c: any) => c.type === "Ready")
      if (readyCond?.status === "True") ready++
    }
    return { total, ready, down: total - ready }
  } catch {
    return { total: 0, ready: 0, down: 0 }
  }
}

export function parseTopNodes(output: string): Map<string, NodeMetrics> {
  const map = new Map<string, NodeMetrics>()
  if (!output) return map

  const lines = output.split("\n")
  for (const line of lines) {
    const parts = line.split(/\s+/).filter(Boolean)
    if (parts.length >= 5) {
      const name = parts[0] ?? ""
      const cpu = parts[1] ?? "0"
      const cpuPct = parseInt(parts[2] ?? "0", 10) || 0
      const mem = parts[3] ?? "0"
      const memPct = parseInt(parts[4] ?? "0", 10) || 0
      map.set(name, { cpuPct, memPct, cpu, mem })
    }
  }
  return map
}

export function parseCpuMillicores(s: string): number {
  if (s.endsWith("m")) return parseInt(s, 10) || 0
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return Math.round(n * 1000)
}

export function parseMemBytes(s: string): number {
  const match = s.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti)?$/i)
  if (!match) return 0
  const val = parseFloat(match[1] ?? "0") || 0
  const unit = (match[2] || "").toLowerCase()
  if (unit === "ki") return val * 1024
  if (unit === "mi") return val * 1024 * 1024
  if (unit === "gi") return val * 1024 * 1024 * 1024
  if (unit === "ti") return val * 1024 * 1024 * 1024 * 1024
  return val
}

export function formatCpuRaw(millicores: number): string {
  if (millicores <= 0) return "0m"
  if (millicores < 1000) return `${millicores}m`
  const cores = millicores / 1000
  if (cores === Math.floor(cores)) return `${cores}c`
  return `${cores.toFixed(1)}c`
}

export function formatMemRaw(bytes: number): string {
  if (bytes <= 0) return "0Mi"
  const gi = bytes / (1024 * 1024 * 1024)
  if (gi >= 1) {
    if (gi === Math.floor(gi)) return `${gi}Gi`
    return `${gi.toFixed(1)}Gi`
  }
  const mi = bytes / (1024 * 1024)
  if (mi >= 1) {
    if (mi === Math.floor(mi)) return `${mi}Mi`
    return `${mi.toFixed(0)}Mi`
  }
  return `${Math.round(bytes / 1024)}Ki`
}

export function parseNamespacedResources(json: string): NamespacedResource[] {
  if (!json) return []
  try {
    const data = JSON.parse(json)
    const items: any[] = data.items || []
    return items.map((item: any): NamespacedResource => ({
      kind: item.kind || "",
      name: item.metadata?.name || "",
      namespace: item.metadata?.namespace || "",
      age: formatAge(item.metadata?.creationTimestamp || ""),
    }))
  } catch {
    return []
  }
}

export function parseTopPods(output: string): Map<string, { cpu: string; mem: string }> {
  const map = new Map<string, { cpu: string; mem: string }>()
  if (!output) return map
  for (const line of output.split("\n")) {
    const parts = line.split(/\s+/).filter(Boolean)
    if (parts.length >= 4) {
      map.set(`${parts[0]}/${parts[1]}`, { cpu: parts[2] ?? "", mem: parts[3] ?? "" })
    }
  }
  return map
}

export function parsePodsFromJson(podsJson: string, topPodsOutput: string): PodDetail[] {
  if (!podsJson) return []
  const podMetrics = parseTopPods(topPodsOutput)
  try {
    const data = JSON.parse(podsJson)
    const items: any[] = data.items || []
    return items.map((pod: any): PodDetail => {
      const name = pod.metadata?.name || ""
      const namespace = pod.metadata?.namespace || ""
      const status = parsePodStatus(pod)
      const age = formatAge(pod.metadata?.creationTimestamp || "")
      const metrics = podMetrics.get(`${namespace}/${name}`)
      return {
        name,
        namespace,
        status,
        cpu: metrics?.cpu || "──",
        mem: metrics?.mem || "──",
        age,
      }
    })
  } catch {
    return []
  }
}

export function findRefPods(
  podsJson: string,
  topPodsOutput: string,
  kind: string,
  name: string,
  namespace: string,
): PodDetail[] {
  if (!podsJson) return []
  const podMetrics = parseTopPods(topPodsOutput)
  try {
    const data = JSON.parse(podsJson)
    const refPods: PodDetail[] = []
    for (const pod of data.items || []) {
      const volumes: any[] = pod.spec?.volumes || []
      const hasVolumeRef = volumes.some((v: any) =>
        (kind === "ConfigMap" && v.configMap?.name === name) ||
        (kind === "Secret" && v.secret?.secretName === name),
      )
      let envRef = false
      for (const c of pod.spec?.containers || []) {
        for (const e of c.env || []) {
          if (kind === "ConfigMap" && e.valueFrom?.configMapKeyRef?.name === name) envRef = true
          if (kind === "Secret" && e.valueFrom?.secretKeyRef?.name === name) envRef = true
        }
        for (const ef of c.envFrom || []) {
          if (kind === "ConfigMap" && ef.configMapRef?.name === name) envRef = true
          if (kind === "Secret" && ef.secretRef?.name === name) envRef = true
        }
      }
      if (hasVolumeRef || envRef) {
        const pName = pod.metadata?.name || ""
        const pNs = pod.metadata?.namespace || namespace
        const status = parsePodStatus(pod)
        const age = formatAge(pod.metadata?.creationTimestamp || "")
        const metrics = podMetrics.get(`${pNs}/${pName}`)
        refPods.push({ name: pName, namespace: pNs, status, cpu: metrics?.cpu || "──", mem: metrics?.mem || "──", age })
      }
    }
    return refPods
  } catch {
    return []
  }
}

export const KIND_CATEGORY: Record<string, ResourceCategory> = {
  Deployment: "workloads",
  StatefulSet: "workloads",
  DaemonSet: "workloads",
  Job: "workloads",
  CronJob: "workloads",
  ReplicaSet: "workloads",
  Service: "network",
  Ingress: "network",
  NetworkPolicy: "network",
  PersistentVolumeClaim: "storage",
  PersistentVolume: "storage",
  StorageClass: "storage",
  ConfigMap: "configuration",
  Secret: "configuration",
}

export const BUILT_IN_API_GROUPS = new Set([
  "",
  "apps",
  "batch",
  "networking.k8s.io",
  "storage.k8s.io",
  "apiextensions.k8s.io",
  "rbac.authorization.k8s.io",
  "admissionregistration.k8s.io",
  "apiextensions.k8s.io",
  "apiregistration.k8s.io",
  "authentication.k8s.io",
  "authorization.k8s.io",
  "autoscaling",
  "coordination.k8s.io",
  "events.k8s.io",
  "flowcontrol.apiserver.k8s.io",
  "metrics.k8s.io",
  "node.k8s.io",
  "policy",
  "scheduling.k8s.io",
  "certificates.k8s.io",
  "discovery.k8s.io",
  "gateway.networking.k8s.io",
])

export function classifyResource(kind: string): ResourceCategory {
  return KIND_CATEGORY[kind] || "configuration"
}

export function buildSummaryRows(kind: string, obj: any): DetailRow[] {
  const rows: DetailRow[] = []
  const meta = obj.metadata || {}
  const labels = meta.labels || {}

  rows.push({ key: "Kind", value: kind })
  rows.push({ key: "Name", value: val(meta.name) })
  rows.push({ key: "Namespace", value: val(obj.metadata?.namespace) })

  const labelEntries = Object.entries(labels)
  if (labelEntries.length === 0) {
    rows.push({ key: "Labels", value: DASH })
  } else {
    rows.push({ key: "Labels", value: "", isParent: true })
    for (const [k, v] of labelEntries) {
      rows.push({ key: k, value: v as string, indent: true })
    }
  }

  rows.push({ key: "Created", value: meta.creationTimestamp ? formatAge(meta.creationTimestamp) : DASH })

  switch (kind) {
    case "Deployment":
    case "StatefulSet": {
      const spec = obj.spec || {}
      rows.push({ key: "Replicas", value: `${spec.replicas ?? DASH}` })
      if (kind === "Deployment") rows.push({ key: "Strategy", value: val(spec.strategy?.type) })
      if (kind === "StatefulSet") rows.push({ key: "Service Name", value: val(spec.serviceName) })
      const selector = spec.selector?.matchLabels || {}
      const selEntries = Object.entries(selector)
      if (selEntries.length > 0) {
        rows.push({ key: "Selector", value: "", isParent: true })
        for (const [k, v] of selEntries) {
          rows.push({ key: k, value: v as string, indent: true })
        }
      }
      break
    }
    case "DaemonSet": {
      const selector = obj.spec?.selector?.matchLabels || {}
      const selEntries = Object.entries(selector)
      if (selEntries.length > 0) {
        rows.push({ key: "Selector", value: "", isParent: true })
        for (const [k, v] of selEntries) {
          rows.push({ key: k, value: v as string, indent: true })
        }
      }
      break
    }
    case "PersistentVolumeClaim": {
      const spec = obj.spec || {}
      const status = obj.status || {}
      const accessModes = (spec.accessModes || []).join(", ")
      rows.push({ key: "Access Modes", value: val(accessModes) })
      rows.push({ key: "Storage", value: val(spec.resources?.requests?.storage) })
      rows.push({ key: "Status", value: val(status.phase) })
      rows.push({ key: "Volume Name", value: val(status.accessModes?.length ? status.capacity?.storage : spec.volumeName) })
      break
    }
    case "Secret": {
      rows.push({ key: "Type", value: val(obj.type) })
      break
    }
    case "ConfigMap": {
      const dataKeys = Object.keys(obj.data || {}).join(", ")
      rows.push({ key: "Data Keys", value: val(dataKeys) })
      break
    }
    case "Service": {
      const spec = obj.spec || {}
      rows.push({ key: "Type", value: val(spec.type) })
      rows.push({ key: "Cluster IP", value: val(spec.clusterIP) })
      const ports = (spec.ports || []).map((p: any) => `${p.port}/${p.protocol || "TCP"}`).join(", ")
      rows.push({ key: "Ports", value: val(ports) })
      break
    }
    case "Ingress": {
      const spec = obj.spec || {}
      const rules = spec.rules || []
      if (rules.length > 0) {
        const hosts = rules.map((r: any) => r.host || "*").join(", ")
        rows.push({ key: "Hosts", value: val(hosts) })
      }
      break
    }
  }

  return rows
}

export function buildGenericSummaryRows(obj: any): DetailRow[] {
  const rows: DetailRow[] = []
  const meta = obj.metadata || {}

  rows.push({ key: "Kind", value: val(obj.kind || "") })
  rows.push({ key: "Name", value: val(meta.name) })
  rows.push({ key: "Namespace", value: val(meta.namespace) })

  const labels = meta.labels || {}
  const labelEntries = Object.entries(labels)
  if (labelEntries.length === 0) {
    rows.push({ key: "Labels", value: DASH })
  } else {
    rows.push({ key: "Labels", value: "", isParent: true })
    for (const [k, v] of labelEntries) {
      rows.push({ key: k, value: v as string, indent: true })
    }
  }

  const annotations = meta.annotations || {}
  const annotationEntries = Object.entries(annotations)
  if (annotationEntries.length === 0) {
    rows.push({ key: "Annotations", value: DASH })
  } else {
    rows.push({ key: "Annotations", value: "", isParent: true })
    for (const [k, v] of annotationEntries) {
      rows.push({ key: k, value: v as string, indent: true })
    }
  }

  rows.push({ key: "Created", value: meta.creationTimestamp ? formatAge(meta.creationTimestamp) : DASH })

  const ownerRefs: any[] = meta.ownerReferences || []
  if (ownerRefs.length === 0) {
    rows.push({ key: "Owners", value: DASH })
  } else {
    rows.push({ key: "Owners", value: "", isParent: true })
    for (const ref of ownerRefs) {
      rows.push({ key: `${ref.kind || ""}/${ref.name || ""}`, value: "", indent: true })
    }
  }

  const finalizers: string[] = meta.finalizers || []
  if (finalizers.length === 0) {
    rows.push({ key: "Finalizers", value: DASH })
  } else {
    rows.push({ key: "Finalizers", value: "", isParent: true })
    for (const f of finalizers) {
      rows.push({ key: f, value: "", indent: true })
    }
  }

  rows.push({ key: "Generation", value: `${meta.generation ?? DASH}` })
  rows.push({ key: "Resource Ver", value: val(meta.resourceVersion) })
  rows.push({ key: "UID", value: val(meta.uid) })

  return rows
}
