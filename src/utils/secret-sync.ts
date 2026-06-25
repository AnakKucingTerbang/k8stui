import type { EnvEntry, SecretManagement, SyncResult } from "../types"
import { sshWriteFile, sshExec, sshReadFile } from "./ssh"
import { kubectlApplyYamlAsync } from "./kube/exec"
import { reannotateSecret } from "./secret-registry"
import { stringifyDotenv } from "./dotenv"

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
