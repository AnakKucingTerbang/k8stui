import type { ReactNode } from "react"

interface SectionProps {
  title: string
  height?: number | string
  width?: number | string
  flexGrow?: number
  children: ReactNode
}

const UNFOCUSED_BORDER = "#30363D"

export function Section({ title, height, width = "100%", flexGrow, children }: SectionProps) {
  const style: Record<string, unknown> = { flexDirection: "column", width }
  if (height !== undefined) style.height = height
  if (flexGrow !== undefined) style.flexGrow = flexGrow

  return (
    <box title={title} borderStyle="single" borderColor={UNFOCUSED_BORDER} style={style}>
      {children}
    </box>
  )
}
