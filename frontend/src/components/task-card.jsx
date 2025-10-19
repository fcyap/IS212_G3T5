"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Settings, CalendarDays, ArchiveRestore } from "lucide-react"
import { CommentSection } from "./task-comment/task-comment-section"

export function TaskCard({ title, priority, status, assignees = [], dateRange, description, deadline, onClick, tags = [], onUnarchive, }) {

  const cap = (s) => (s ? s.toString().charAt(0).toUpperCase() + s.toString().slice(1).toLowerCase() : "")
  const p = (priority || "").toLowerCase()
  const s = (status || "").toLowerCase()


  const a = assignees ?? {
    name: "",
    avatar: "",
    fallback: (title?.[0] ?? "?").toUpperCase(),
    color: "bg-gray-600",
  }

  const dueText = deadline || (dateRange ? dateRange.replace(/^Due\s*/i, "") : null)

  const getPriorityColor = () => {
    switch (p) {
      case "low": return "bg-teal-200 text-teal-900"
      case "medium": return "bg-amber-300 text-amber-950"
      case "high": return "bg-fuchsia-300 text-fuchsia-950"
      default: return "bg-gray-600 text-white"
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);


  const isOverdue =
    (status === "pending" || status === "in_progress") &&
    deadline &&
    new Date(deadline) < today;


  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`border rounded-lg p-4 hover:border-gray-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40
    ${isOverdue
      ? "bg-red-950/40 border-red-500"
      : "bg-[#2a2a2e] border-gray-600"}`}
      >     
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-white font-medium">{title}</h3>
        </div>
        {onUnarchive ? (
          <button
            type="button"
            title="Unarchive"
            onClick={(e) => {
              e.stopPropagation();
              onUnarchive?.();
            }}
            className="p-1 rounded text-gray-200 hover:bg-gray-700"
          >
            <ArchiveRestore className="w-4 h-4" />
          </button>
        ) : (
          <Settings className="w-4 h-4 text-gray-400" />
        )}

      </div>

      {/* Badges */}
      <div className="mt-3 flex items-center gap-2">
        {priority ? <Badge className={`text-xs px-2 py-1 ${getPriorityColor()}`}>{cap(priority)}</Badge> : null}
      </div>


      {/* Avatar + Deadline + Tags */}
      <div className="mt-3 flex items-center">
        <div className="flex items-center gap-2">
          {assignees.length > 0 && (
            <div className="flex -space-x-2">
              {assignees.slice(0, 3).map((a, i) => (
                <Avatar key={i} className="w-6 h-6 border-2 border-[#2a2a2e]">
                  <AvatarFallback className="bg-gray-600 text-white text-xs font-medium">
                    {(a.name?.charAt(0) || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-[#2a2a2e] text-[10px] text-gray-200 flex items-center justify-center">
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          )}

          {dueText && (
            <span className="flex items-center gap-1 text-sm text-gray-400">
              <CalendarDays className="w-4 h-4" />
              <span>Due {dueText}</span>
            </span>
          )}
        </div>

        {/* Tags — compact, right aligned */}
        {Array.isArray(tags) && tags.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded-md px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200"
                title={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>


    </div>

  )
}
