interface ToastProps {
  message: string
}

export function Toast({ message }: ToastProps) {
  if (!message) return null

  return (
    <box
      style={{
        position: "absolute",
        bottom: 2,
        right: 1,
        width: 28,
        height: 3,
        zIndex: 50,
        backgroundColor: "#1A3A5C",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg="#E6EDF3" content={message} />
    </box>
  )
}
