import { PodTable } from "../../components/PodTable"
import type { PodDetail } from "../../types"

interface RefsViewProps {
  pods: PodDetail[]
  podIndex: number
  scrollRef: React.RefObject<any>
}

export function RefsView({ pods, podIndex, scrollRef }: RefsViewProps) {
  if (pods.length === 0) {
    return (
      <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
        <text fg="#8B949E" content="No pods reference this secret" />
      </box>
    )
  }

  return <PodTable pods={pods} selectedIndex={podIndex} scrollRef={scrollRef} />
}
