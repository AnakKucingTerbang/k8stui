import type { EnvEntry, ComparisonResult } from "../types"

function decodeBase64(raw: string): string {
  try {
    return Buffer.from(raw, "base64").toString("utf8")
  } catch {
    return "<binary>"
  }
}

export function compareEnvWithSecret(
  entries: EnvEntry[],
  rawData: Record<string, string>,
): ComparisonResult {
  const envMap = new Map<string, string>()
  for (const entry of entries) {
    if (!entry.isComment && !entry.isBlank) {
      envMap.set(entry.key, entry.value)
    }
  }

  const clusterMap = new Map<string, string>()
  for (const [key, raw] of Object.entries(rawData)) {
    clusterMap.set(key, decodeBase64(raw))
  }

  const matching: ComparisonResult["matching"] = []
  const different: ComparisonResult["different"] = []
  const onlyInCluster: ComparisonResult["onlyInCluster"] = []
  const onlyInEnv: ComparisonResult["onlyInEnv"] = []

  for (const [key, clusterValue] of clusterMap) {
    const envValue = envMap.get(key)
    if (envValue === undefined) {
      onlyInCluster.push({ key, clusterValue })
    } else if (envValue === clusterValue) {
      matching.push({ key, value: clusterValue })
    } else {
      different.push({ key, clusterValue, envValue })
    }
    envMap.delete(key)
  }

  for (const [key, envValue] of envMap) {
    onlyInEnv.push({ key, envValue })
  }

  return { matching, different, onlyInCluster, onlyInEnv }
}
