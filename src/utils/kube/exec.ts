import { exec, execSync } from "child_process"

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
