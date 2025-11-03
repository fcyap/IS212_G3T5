"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus, Archive } from "lucide-react"
import { useKanban } from "@/components/kanban-context"

const colorVar = (token) => `rgb(var(--${token}))`

export function BoardHeader() {
  const { startAddTask } = useKanban()
  const router = useRouter()
  const [isAddHovered, setIsAddHovered] = useState(false)
  const [isArchiveHovered, setIsArchiveHovered] = useState(false)

  return (
    <div
      className="px-3 sm:px-6 py-3 border-b touch-manipulation min-h-[44px]"
      style={{
        borderColor: "rgb(var(--border))",
        backgroundColor: "rgb(var(--card))",
        color: "rgb(var(--foreground))",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <Button
          onClick={() => startAddTask("top", "pending")}
          className="touch-manipulation min-h-[44px]"
          style={{
            backgroundColor: isAddHovered ? colorVar("accent") : colorVar("muted"),
            color: isAddHovered ? colorVar("accent-foreground") : colorVar("foreground"),
            transition: "background-color 150ms ease, color 150ms ease",
          }}
          onMouseEnter={() => setIsAddHovered(true)}
          onMouseLeave={() => setIsAddHovered(false)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add task
        </Button>
        <Button
          onClick={() => router.push("/archive")}
          className="touch-manipulation min-h-[44px]"
          style={{
            backgroundColor: isArchiveHovered ? colorVar("accent") : colorVar("muted"),
            color: isArchiveHovered ? colorVar("accent-foreground") : colorVar("foreground"),
            transition: "background-color 150ms ease, color 150ms ease",
          }}
          onMouseEnter={() => setIsArchiveHovered(true)}
          onMouseLeave={() => setIsArchiveHovered(false)}
        >
          <Archive className="w-4 h-4 mr-2" />
          Archive
        </Button>
      </div>
    </div>
  )
}
