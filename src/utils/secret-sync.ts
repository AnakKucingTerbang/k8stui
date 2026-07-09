import type { EnvEntry, SecretManagement, SyncResult } from "../types"
import { sshWriteFile, sshExec, sshReadFile } from "./ssh"
import { kubectlApplyYamlAsync } from "./kube/exec"
import { reannotateSecret } from "./secret-registry"
import { stringifyDotenv, parseDotenv } from "./dotenv"

function buildSecretYaml(name: string, namespace: string, entries: EnvEntry[]): string {
  const data: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.isComment || entry.isBlank) continue
    data[entry.key] = Buffer.from(entry.value).toString("base64")
  }

  const dataLines = Object.entries(data)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n")

  return [
    "apiVersion: v1",
    "kind: Secret",
    "metadata:",
    `  name: ${name}`,
    `  namespace: ${namespace}`,
    "type: Opaque",
    "data:",
    dataLines,
  ].join("\n")
}

export async function syncSecretFromEnv(
  entries: EnvEntry[],
  management: SecretManagement,
  contextName: string,
  namespace: string,
  name: string,
): Promise<SyncResult> {
  const envContent = stringifyDotenv(entries)

  const tempPath = management.path + ".new"
  try {
    await sshWriteFile(management.host, tempPath, envContent)
  } catch (err: any) {
    return { success: false, output: `Failed to write .env: ${err.message || err}` }
  }

  try {
    const mvResult = await sshExec(management.host, `mv ${tempPath} ${management.path}`)
    if (mvResult.code !== 0) {
      try { await sshExec(management.host, `rm -f ${tempPath}`) } catch {}
      return { success: false, output: `Failed to rename temp file: ${mvResult.stderr || mvResult.stdout}` }
    }
  } catch (err: any) {
    try { await sshExec(management.host, `rm -f ${tempPath}`) } catch {}
    return { success: false, output: `Failed to rename temp file: ${err.message || err}` }
  }

  try {
    const readBack = await sshReadFile(management.host, management.path)
    if (readBack.trim() !== envContent.trim()) {
      return { success: false, output: "Verification failed: file content mismatch after write" }
    }
  } catch (err: any) {
    return { success: false, output: `Verification failed: could not read back file: ${err.message || err}` }
  }

  try {
    const yaml = buildSecretYaml(name, namespace, entries)
    const result = await kubectlApplyYamlAsync(contextName, yaml)
    if (!result.success) {
      return { success: false, output: result.output || "kubectl apply failed" }
    }
  } catch (err: any) {
    return { success: false, output: `Failed to sync secret: ${err.message || err}` }
  }

  try {
    await reannotateSecret(contextName, namespace, name, management.host, management.path)
  } catch {}

  return { success: true, output: "Secret synced" }
}

export async function saveEnvEntry(
  management: SecretManagement,
  contextName: string,
  namespace: string,
  secretName: string,
  mode: "add" | "edit",
  key: string,
  value: string,
  originalKey?: string,
): Promise<SyncResult> {
  let content: string
  try {
    content = await sshReadFile(management.host, management.path)
  } catch (err: any) {
    return { success: false, output: `Failed to read .env: ${err.message || err}` }
  }

let entries = parseDotenv(content)

  if (mode === "add") {
    entries.push({ key, value, isComment: false, isBlank: false })
  } else {
    const idx = entries.findIndex(e => !e.isComment && !e.isBlank && e.key === (originalKey ?? key))
    if (idx === -1) {
      entries.push({ key, value, isComment: false, isBlank: false })
    } else {
      const entry = entries[idx]
      if (entry) {
        entries[idx] = { key, value, isComment: entry.isComment, isBlank: entry.isBlank }
      }
    }
  }

  return syncSecretFromEnv(entries, management, contextName, namespace, secretName)
}

export async function deleteEnvEntry(
  management: SecretManagement,
  contextName: string,
  namespace: string,
  secretName: string,
  key: string,
): Promise<SyncResult> {
  let content: string
  try {
    content = await sshReadFile(management.host, management.path)
  } catch (err: any) {
    return { success: false, output: `Failed to read .env: ${err.message || err}` }
  }

  let entries = parseDotenv(content)

  entries = entries.filter(e => {
    if (e.isComment) return true
    if (e.isBlank) return true
    if (e.key === key) return false
    return true
  })

  return syncSecretFromEnv(entries, management, contextName, namespace, secretName)
}
