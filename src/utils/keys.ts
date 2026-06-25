export const SPECIAL_KEYS = new Set([
  "return", "escape", "backspace", "delete", "up", "down", "left", "right",
  "tab", "home", "end", "pageup", "pagedown", "space", "enter",
])

export function isPrintable(keyName: string): boolean {
  return keyName.length === 1 && !SPECIAL_KEYS.has(keyName)
}
