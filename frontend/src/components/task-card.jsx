"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Circle, Settings } from "lucide-react"

export function TaskCard({ title, priority, status, assignee, dateRange }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "Low":
        return "bg-green-600 text-white"
      case "Medium":
        return "bg-yellow-600 text-white"
      case "High":
        return "bg-purple-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "On track":
        return "bg-green-600 text-white"
      case "At risk":
        return "bg-yellow-600 text-white"
      case "Off track":
        return "bg-red-600 text-white"
      default:
        return "bg-gray-600 text-white"
    }
  }

  return (
    <div className="bg-[#2a2a2e] border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors cursor-pointer">
      <div className="flex items-start gap-3 mb-3">
        <Circle className="w-5 h-5 text-gray-400 mt-0.5" />
        <h3 className="text-white font-medium flex-1">{title}</h3>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Badge className={`text-xs px-2 py-1 ${getPriorityColor(priority)}`}>{priority}</Badge>
        <Badge className={`text-xs px-2 py-1 ${getStatusColor(status)}`}>{status}</Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarFallback className={`${assignee.color} text-white text-xs font-medium`}>
              {assignee.fallback}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-400">{dateRange}</span>
        </div>
        <Settings className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  )
}
