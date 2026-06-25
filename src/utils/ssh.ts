import { execSync } from "child_process"
import { readFileSync } from "fs"
import { Client, type SFTPWrapper } from "ssh2"
import type { SshTestResult } from "../types"
import { log } from "./log"

function suppressSshWarn<T>(fn: () => Promise<T>): Promise<T> {
  const origWarn = console.warn
  const origEmitWarning = process.emitWarning
  console.warn = (...args: any[]) => {
    const msg = args.join(" ")
    if (msg.includes("unable to read /etc/")) {
      log(msg)
      return
    }
    origWarn.apply(console, args)
  }
  process.emitWarning = (warning: string | Error, options?: any) => {
    const msg = String(warning)
    if (msg.includes("unable to read /etc/")) {
      log(msg)
      return true
    }
    return origEmitWarning.apply(process, [warning, options] as any)
  }
  return fn().finally(() => {
    console.warn = origWarn
    process.emitWarning = origEmitWarning
  })
}

interface SshConfig {
  host: string
  port: number
  user: string
  identityFile?: string
}

function parseHostString(hostString: string): { user?: string; host: string; port?: number } {
  let remaining = hostString.trim()

  const userMatch = remaining.match(/^([^@]+)@(.+)$/)
  let user: string | undefined
  if (userMatch) {
    user = userMatch[1]
    remaining = userMatch[2] ?? remaining
  }

  const portMatch = remaining.match(/^(.+):(\d+)$/)
  let port: number | undefined
  let host: string = remaining
  if (portMatch) {
    host = portMatch[1] ?? remaining
    port = parseInt(portMatch[2] ?? "22", 10)
  }

  return { user, host, port }
}

function resolveFromSshConfig(alias: string): Partial<SshConfig> {
  try {
    const output = execSync(`ssh -G ${alias}`, { encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }).trim()
    const lines = output.split("\n")
    const config: Partial<SshConfig> = {}
    for (const line of lines) {
      const parts = line.match(/^(\S+)\s+(.+)$/)
      if (!parts) continue
      const key = parts[1]?.toLowerCase()
      const val = parts[2]
      if (!val) continue
      if (key === "hostname") config.host = val
      if (key === "port") config.port = parseInt(val, 10)
      if (key === "user") config.user = val
      if (key === "identityfile") config.identityFile = val.replace(/^~/, process.env.HOME || "/home")
    }
    return config
  } catch {
    return {}
  }
}

export function resolveSshConfig(hostString: string): SshConfig {
  const parsed = parseHostString(hostString)

  const sshGConfig = resolveFromSshConfig(parsed.host)

  return {
    host: sshGConfig.host || parsed.host,
    port: parsed.port || sshGConfig.port || 22,
    user: parsed.user || sshGConfig.user || process.env.USER || "root",
    identityFile: sshGConfig.identityFile,
  }
}

function createConnection(config: SshConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client()

    const connectOpts: any = {
      host: config.host,
      port: config.port,
      username: config.user,
      readyTimeout: 10000,
    }

    if (config.identityFile) {
      connectOpts.privateKey = readFileSync(config.identityFile)
    }

    client.on("ready", () => resolve(client))
    client.on("error", (err) => reject(err))

    client.connect(connectOpts)
  })
}

function disconnect(client: Client): void {
  client.end()
}

function getSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => {
      if (err) reject(err)
      else resolve(sftp)
    })
  })
}

export async function sshTestConnection(hostString: string, filePath: string): Promise<SshTestResult> {
  return suppressSshWarn(async () => {
    const config = resolveSshConfig(hostString)

    let client: Client
    try {
      client = await createConnection(config)
    } catch (err: any) {
      return { connected: false, fileExists: false, error: err.message || "Connection failed" }
    }

    try {
      const sftp = await getSftp(client)
      return new Promise((resolve) => {
        sftp.stat(filePath, (err) => {
          disconnect(client)
          if (err) {
            resolve({ connected: true, fileExists: false })
          } else {
            resolve({ connected: true, fileExists: true })
          }
        })
      })
    } catch {
      disconnect(client)
      return { connected: true, fileExists: false, error: "SFTP failed" }
    }
  })
}

export async function sshReadFile(hostString: string, filePath: string): Promise<string> {
  return suppressSshWarn(async () => {
    const config = resolveSshConfig(hostString)
    const client = await createConnection(config)

    try {
      const sftp = await getSftp(client)
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        const stream = sftp.createReadStream(filePath)
        stream.on("data", (chunk: Buffer) => chunks.push(chunk))
        stream.on("end", () => {
          disconnect(client)
          resolve(Buffer.concat(chunks).toString("utf8"))
        })
        stream.on("error", (err: any) => {
          disconnect(client)
          reject(err)
        })
      })
    } catch (err) {
      disconnect(client)
      throw err
    }
  })
}

export async function sshWriteFile(hostString: string, filePath: string, content: string): Promise<void> {
  return suppressSshWarn(async () => {
    const config = resolveSshConfig(hostString)
    const client = await createConnection(config)

    try {
      const sftp = await getSftp(client)
      return new Promise((resolve, reject) => {
        sftp.writeFile(filePath, content, { encoding: "utf8" }, (err) => {
          disconnect(client)
          if (err) reject(err)
          else resolve()
        })
      })
    } catch (err) {
      disconnect(client)
      throw err
    }
  })
}

export async function sshExec(hostString: string, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return suppressSshWarn(async () => {
    const config = resolveSshConfig(hostString)
    const client = await createConnection(config)

    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) {
          disconnect(client)
          reject(err)
          return
        }

        let stdout = ""
        let stderr = ""

        stream.on("data", (data: Buffer) => { stdout += data.toString() })
        stream.stderr.on("data", (data: Buffer) => { stderr += data.toString() })
        stream.on("close", (code: number | null) => {
          disconnect(client)
          resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 0 })
        })
      })
    })
  })
}

export async function sshCreateEmptyFile(hostString: string, filePath: string): Promise<void> {
  await sshWriteFile(hostString, filePath, "")
}
