"use client"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useKanban } from "@/components/kanban-context"

export function BoardHeader() {
  const { startAddTask } = useKanban()

  return (
    <div className="px-6 py-3 border-b" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--card))', color: 'rgb(var(--card-foreground))' }}>
      <div className="flex items-center">
        <Button 
          onClick={() => startAddTask("top", "pending")} 
          className="text-white"
          style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--border))' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgb(var(--accent))'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'rgb(var(--muted))'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add task
        </Button>
      </div>
    </div>
  )
}
