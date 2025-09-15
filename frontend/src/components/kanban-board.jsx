"use client"

import { Button } from "@/components/ui/button"
import { TaskCard } from "./task-card"
import { Plus } from "lucide-react"

export function KanbanBoard() {
  const todoTasks = [
    {
      title: "Break down epics",
      priority: "Low",
      status: "On track",
      assignee: {
        name: "Y",
        avatar: "",
        fallback: "Y",
        color: "bg-purple-500",
      },
      dateRange: "10 - 12 Sep",
    },
    {
      title: "Common idea of app",
      priority: "Medium",
      status: "At risk",
      assignee: {
        name: "Y",
        avatar: "",
        fallback: "Y",
        color: "bg-purple-500",
      },
      dateRange: "11 Sep - Today",
    },
    {
      title: "Daily Call",
      priority: "High",
      status: "Off track",
      assignee: {
        name: "Y",
        avatar: "",
        fallback: "Y",
        color: "bg-purple-500",
      },
      dateRange: "12 - 16 Sep",
    },
  ]

  return (
    <div className="flex-1 bg-[#1a1a1d] p-6">
      <div className="grid grid-cols-3 gap-6 h-full">
        {/* To do Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">To do</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">3</span>
            </div>
          </div>

          <div className="space-y-3">
            {todoTasks.map((task, index) => (
              <TaskCard key={index} {...task} />
            ))}

            <Button
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add task
            </Button>
          </div>
        </div>

        {/* Doing Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Doing</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">0</span>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add task
          </Button>
        </div>

        {/* Done Column */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-medium">Done</h2>
              <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">0</span>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add section
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full text-gray-400 hover:text-white hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-gray-500 py-8"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add task
          </Button>
        </div>
      </div>
    </div>
  )
}
