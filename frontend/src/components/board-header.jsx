"use client"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useKanban } from "@/components/kanban-context"

export function BoardHeader() {
  const { startAddTask } = useKanban()

  return (
    <div className="px-3 sm:px-6 py-3 border-b touch-manipulation min-h-[44px]" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))', color: 'rgb(var(--foreground))' }}>
      <div className="flex items-center">
        <Button
          onClick={() => startAddTask("top", "pending")}
          className="touch-manipulation min-h-[44px]"
          style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--accent))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add task
        </Button>
      </div>
    </div>
  )
}
