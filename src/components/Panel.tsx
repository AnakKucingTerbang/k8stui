import type { ReactNode } from "react"

interface PanelProps {
  title: string
  focused?: boolean
  borderColor?: string
  height?: number | string
  width?: number | string
  flexGrow?: number
  gap?: number
  children: ReactNode
}

const FOCUSED_BORDER = "#58A6FF"
const UNFOCUSED_BORDER = "#30363D"

export function Panel({ title, focused = false, borderColor, height, width = "100%", flexGrow, gap, children }: PanelProps) {
  const resolvedBorderColor = borderColor ?? (focused ? FOCUSED_BORDER : UNFOCUSED_BORDER)
  const style: Record<string, unknown> = { flexDirection: "column", width }
  if (height !== undefined) style.height = height
  if (flexGrow !== undefined) style.flexGrow = flexGrow
  if (gap !== undefined) style.gap = gap

  return (
    <box title={title} borderStyle="single" borderColor={resolvedBorderColor} style={style}>
      {children}
    </box>
  )
}
