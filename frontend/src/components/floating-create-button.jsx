"use client"

import { CreateProjectDialog } from "./create-project"
import { Button } from "./ui/button"
import { Plus } from "lucide-react"

export function FloatingCreateButton() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <CreateProjectDialog>
        <Button 
          size="lg"
          className="rounded-full w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </CreateProjectDialog>
    </div>
  )
}
