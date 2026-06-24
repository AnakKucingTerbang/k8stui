export function copyToClipboard(text: string): void {
  const encoded = Buffer.from(text).toString("base64")
  process.stdout.write(`\x1b]52;c;${encoded}\x07`)
}
