import type { ReactNode } from "react"

interface ModalProps {
  title: string
  top: number
  left: number
  width: number
  height: number
  footer?: ReactNode
  children: ReactNode
  zIndex?: number
}

const FOCUSED_BORDER = "#58A6FF"

export function Modal({ title, top, left, width, height, footer, children, zIndex }: ModalProps) {
  return (
    <box
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        flexDirection: "column",
        zIndex: zIndex ?? 100,
        backgroundColor: "#0D1117",
      }}
    >
      <box
        title={title}
        borderStyle="single"
        borderColor={FOCUSED_BORDER}
        style={{ flexDirection: "column", flexGrow: 1, gap: 0 }}
      >
        {children}
      </box>
      {footer}
    </box>
  )
}
