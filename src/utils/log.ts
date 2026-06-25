import { appendFileSync, mkdirSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const LOG_DIR = join(homedir(), ".k8cli")
const LOG_FILE = join(LOG_DIR, "k8cli.log")

export function log(msg: string): void {
  const ts = new Date().toISOString()
  mkdirSync(LOG_DIR, { recursive: true })
  appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`)
}
