"use client"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useKanban } from "@/components/kanban-context"

export function BoardHeader() {
  const { startAddTask } = useKanban()

  return (
    <div className="px-6 py-3 border-b border-gray-700 bg-[#1f1f23] text-white">
      <div className="flex items-center">
        <Button onClick={() => startAddTask("top", "pending")} className="bg-gray-700 hover:bg-gray-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add task
        </Button>
      </div>
    </div>
  )
}
