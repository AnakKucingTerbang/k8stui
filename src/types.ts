export type ClusterStatus = "connected" | "degraded" | "unreachable"

export interface KubeContext {
  name: string
  cluster: string
  user: string
  server: string
}

export type MetricMode = "pct" | "raw"

export interface Cluster {
  contextName: string
  name: string
  status: ClusterStatus
  nodeOnline: number
  nodeTotal: number
  cpuPct: number
  memPct: number
  cpuRaw: string
  memRaw: string
  podsUsed: number
  podsTotal: number
  notes: string
}

export interface NodeDetail {
  name: string
  ready: boolean
  cpuPct: number
  memPct: number
  cpu: string
  mem: string
  age: string
  podsUsed: number
  podsTotal: number
  cpuAllocatable: number
  memAllocatable: number
}

export interface PodDetail {
  name: string
  namespace: string
  status: string
  cpu: string
  mem: string
  age: string
}

export interface PodContainer {
  name: string
  image: string
  command: string[]
  args: string[]
  ports: string[]
  cpuRequest: string
  cpuLimit: string
  memRequest: string
  memLimit: string
  livenessProbe: string
  readinessProbe: string
  env: { name: string; value: string }[]
  volumeMountNames: string[]
  pvcRefNames: string[]
  secretRefNames: string[]
  configMapRefNames: string[]
}

export interface DetailRow {
  key: string
  value: string
  isParent?: boolean
  indent?: boolean
}

export interface ApplicationResource {
  kind: string
  name: string
  namespace: string
  lastAppliedYaml: string
  summaryRows: DetailRow[]
}

export interface PodDetailFull {
  name: string
  namespace: string
  labels: string[]
  annotations: string[]
  created: string
  containers: PodContainer[]
  phase: string
  podIP: string
  hostIP: string
  restarts: number
  ready: boolean
  qosClass: string
  yaml: string
  appResources: ApplicationResource[] | undefined
  ownerKind: string
  ownerName: string
}

export interface NamespaceInfo {
  name: string
  age: string
  pods: number
  workloads: number
  network: number
  storage: number
  config: number
}

export type ResourceCategory = "workloads" | "network" | "storage" | "configuration"

export interface ClusterResource {
  kind: string
  name: string
  namespace: string
  category: ResourceCategory
}

export interface NodeCondition {
  type: string
  status: string
  reason: string
  message: string
  lastTransitionTime: string
}

export interface NamespacedResource {
  kind: string
  name: string
  namespace: string
  age: string
}

export interface NamespaceDetailData {
  workloads: NamespacedResource[]
  pods: PodDetail[]
  network: NamespacedResource[]
  config: NamespacedResource[]
}

export interface WorkloadDetailData {
  summary: DetailRow[]
  pods: PodDetail[]
}

export interface NetworkDetailData {
  summary: DetailRow[]
  pods: PodDetail[]
}

export interface StorageDetailData {
  summary: DetailRow[]
  mountPod: PodDetail | null
}

export interface ConfigDetailData {
  summary: DetailRow[]
  pods: PodDetail[]
}

export interface SecretDetailData {
  summary: DetailRow[]
  dataKeys: string[]
  rawData: Record<string, string>
  pods: PodDetail[]
  annotations: Record<string, string>
}

export interface ClusterDetailData {
  nodes: NodeDetail[]
  namespaces: NamespaceInfo[]
  resources: ClusterResource[]
}

export interface ApiGroupInfo {
  name: string
  preferredVersion: string
  groupVersion: string
}

export interface ApiResourceKind {
  name: string
  kind: string
  namespaced: boolean
  shortNames: string[]
  verbs: string[]
}

export interface CustomGroup {
  apiGroup: ApiGroupInfo
  kinds: ApiResourceKind[]
}

export interface CustomResourceDetailData {
  summary: DetailRow[]
  yaml: string
}

export interface EnvEntry {
  key: string
  value: string
  comment?: string
  isComment: boolean
  isBlank: boolean
}

export interface SecretManagement {
  strategy: "kubectl" | "dotenv"
  host: string
  path: string
}

export interface SyncResult {
  success: boolean
  output: string
}

export interface SshTestResult {
  connected: boolean
  fileExists: boolean
  error?: string
}

export interface ComparisonResult {
  matching: { key: string; value: string }[]
  different: { key: string; clusterValue: string; envValue: string }[]
  onlyInCluster: { key: string; clusterValue: string }[]
  onlyInEnv: { key: string; envValue: string }[]
}

export interface PortForwardEntry {
  localPort: number
  containerPort: number
  containerName: string
  protocol: string
}
