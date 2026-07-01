import { exec, execSync, spawn } from "child_process"

export function kubectlAsync(args: string, timeout = 5000): Promise<string> {
  return new Promise((resolve) => {
    exec(`kubectl ${args}`, { encoding: "utf8", timeout }, (err, stdout) => {
      resolve(err ? "" : stdout.trim())
    })
  })
}

export function kubectlContextAsync(context: string, args: string, timeout = 5000): Promise<string> {
  return kubectlAsync(`--context=${context} ${args}`, timeout)
}

export function kubectlSync(args: string, timeout = 5000): string {
  try {
    return execSync(`kubectl ${args}`, {
      encoding: "utf8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
  } catch {
    return ""
  }
}

export function getCurrentContext(): string {
  return kubectlSync("config current-context") || ""
}

export function switchContext(context: string): boolean {
  const result = kubectlSync(`config use-context ${context}`)
  return result.includes(`Switched to context "${context}"`)
}

export function kubectlApplyYamlAsync(
  context: string,
  yaml: string,
  timeout: number = 10000,
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn("kubectl", ["--context", context, "apply", "-f", "-"], { timeout })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString() })
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString() })
    child.on("close", (code) => {
      if (code === 0) resolve({ success: true, output: stdout.trim() })
      else resolve({ success: false, output: stderr.trim() || stdout.trim() })
    })
    child.on("error", () => resolve({ success: false, output: "kubectl not found" }))
    child.stdin.write(yaml)
    child.stdin.end()
  })
}

export function rolloutRestartAsync(
  context: string,
  kind: string,
  name: string,
  namespace: string,
  timeout = 15000,
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const kindFlag = kind.toLowerCase()
    exec(
      `kubectl --context=${context} rollout restart ${kindFlag} ${name} -n ${namespace}`,
      { encoding: "utf8", timeout },
      (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, output: (stderr || err.message || "unknown error").trim() })
        } else {
          resolve({ success: true, output: stdout.trim() })
        }
      },
    )
  })
}
