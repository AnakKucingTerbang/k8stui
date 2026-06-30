import type { ApiGroupInfo, ApiResourceKind, CustomGroup, NamespacedResource } from "../../types"
import { kubectlContextAsync } from "./exec"
import { BUILT_IN_API_GROUPS, parseNamespacedResources } from "./parse"

async function concurrentPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 10,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const settled = await Promise.allSettled(chunk.map(fn))
    results.push(...settled)
  }
  return results
}

export async function fetchApiGroupsAsync(contextName: string): Promise<CustomGroup[]> {
  const raw = await kubectlContextAsync(contextName, "get --raw /apis", 10000)
  if (!raw) return []

  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }

  const groups: any[] = data.groups || []
  const filtered = groups.filter((g: any) => {
    const name: string = g.name || ""
    return !BUILT_IN_API_GROUPS.has(name)
  })

  const customGroups: CustomGroup[] = []

  const groupResults = await concurrentPool(
    filtered,
    async (g: any) => {
      const pref = g.preferredVersion || g.versions?.[0]
      if (!pref) return null
      const groupVersion: string = pref.groupVersion || ""
      if (!groupVersion) return null
      const kinds = await fetchGroupKindsAsync(contextName, groupVersion)
      if (kinds.length === 0) return null
      return {
        apiGroup: {
          name: g.name || "",
          preferredVersion: pref.version || "",
          groupVersion,
        },
        kinds,
      } as CustomGroup
    },
    10,
  )

  for (const r of groupResults) {
    if (r.status === "fulfilled" && r.value !== null) {
      customGroups.push(r.value)
    }
  }

  return customGroups
}

export async function fetchGroupKindsAsync(contextName: string, groupVersion: string): Promise<ApiResourceKind[]> {
  const raw = await kubectlContextAsync(contextName, `get --raw /apis/${groupVersion}`, 10000)
  if (!raw) return []

  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }

  const resources: any[] = data.resources || []
  return resources
    .filter((r: any) => {
      const name: string = r.name || ""
      if (name.includes("/")) return false
      const verbs: string[] = r.verbs || []
      return verbs.includes("list")
    })
    .map((r: any): ApiResourceKind => ({
      name: r.name || "",
      kind: r.kind || "",
      namespaced: r.namespaced === true,
      shortNames: r.shortNames || [],
      verbs: r.verbs || [],
    }))
}

export async function fetchAllCustomResourcesAsync(
  contextName: string,
  groups: CustomGroup[],
): Promise<Record<string, NamespacedResource[]>> {
  const pairs: Array<{ gv: string; plural: string }> = []
  for (const g of groups) {
    for (const k of g.kinds) {
      pairs.push({ gv: g.apiGroup.groupVersion, plural: k.name })
    }
  }

  const results = await concurrentPool(
    pairs,
    async ({ gv, plural }) => {
      const raw = await kubectlContextAsync(contextName, `get --raw /apis/${gv}/${plural}`, 10000)
      if (!raw) return { gv, resources: [] as NamespacedResource[] }
      let data: any
      try {
        data = JSON.parse(raw)
      } catch {
        return { gv, resources: [] as NamespacedResource[] }
      }
      const items: any[] = data.items || []
      const resources: NamespacedResource[] = items.map((item: any) => {
        const metadata = item.metadata || {}
        const creationTimestamp = metadata.creationTimestamp || ""
        const age = creationTimestamp
          ? formatAgeFromDate(creationTimestamp)
          : ""
        return {
          kind: item.kind || "",
          name: metadata.name || "",
          namespace: metadata.namespace || "",
          age,
        }
      })
      return { gv, resources }
    },
    10,
  )

  const map: Record<string, NamespacedResource[]> = {}
  for (const r of results) {
    if (r.status === "fulfilled") {
      const { gv, resources } = r.value
      if (!map[gv]) map[gv] = []
      map[gv].push(...resources)
    }
  }

  return map
}

function formatAgeFromDate(timestamp: string): string {
  const created = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  if (diffMs < 0) return ""
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  const years = Math.floor(days / 365)
  return `${years}y`
}
