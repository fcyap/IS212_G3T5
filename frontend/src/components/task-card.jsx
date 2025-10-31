"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Settings, CalendarDays, ArchiveRestore } from "lucide-react"
import { CommentSection } from "./task-comment/task-comment-section"
import { TaskAttachmentsDisplay } from "./task-attachments-display"

export function TaskCard({ title, priority, status, assignees = [], dateRange, description, deadline, onClick, tags = [], onUnarchive, taskId, }) {

  const cap = (s) => (s ? s.toString().charAt(0).toUpperCase() + s.toString().slice(1).toLowerCase() : "")
  const p = Number(priority) || 5 // Priority is now 1-10
  const s = (status || "").toLowerCase()


  const a = assignees ?? {
    name: "",
    avatar: "",
    fallback: (title?.[0] ?? "?").toUpperCase(),
    color: "bg-gray-600",
  }

  const dueText = deadline || (dateRange ? dateRange.replace(/^Due\s*/i, "") : null)

  const getPriorityColor = () => {
    // Color mapping for 1-10 scale: 1-3 low (green), 4-6 medium (yellow), 7-10 high (red)
    if (p >= 9) return "bg-fuchsia-400 text-fuchsia-950"
    if (p >= 7) return "bg-red-300 text-red-950"
    if (p >= 4) return "bg-amber-300 text-amber-950"
    return "bg-teal-200 text-teal-900"
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
      className={`border rounded-lg p-3 sm:p-4 hover:border-gray-500 active:border-gray-400 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 touch-manipulation
    ${isOverdue
      ? "bg-red-950/40 border-red-500"
      : "bg-[#2a2a2e] border-gray-600"}`}
      >     
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm sm:text-base break-words">{title}</h3>
        </div>
        {onUnarchive ? (
          <button
            type="button"
            title="Unarchive"
            onClick={(e) => {
              e.stopPropagation();
              onUnarchive?.();
            }}
            className="p-2 rounded text-gray-200 hover:bg-gray-700 active:bg-gray-600 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
          >
            <ArchiveRestore className="w-4 h-4" />
          </button>
        ) : (
          <Settings className="w-4 h-4 text-gray-400" />
        )}

      </div>

      {/* Badges */}
      <div className="mt-2 sm:mt-3 flex items-center gap-2 flex-wrap">
        {priority ? <Badge className={`text-xs px-2 py-1 ${getPriorityColor()}`}>{p}</Badge> : null}
      </div>


      {/* Avatar + Deadline + Tags */}
      <div className="mt-2 sm:mt-3 flex items-center flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
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
            <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 whitespace-nowrap">
              <CalendarDays className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="truncate">Due {dueText}</span>
            </span>
          )}

          {/* Attachment count */}
          {taskId && (
            <TaskAttachmentsDisplay taskId={taskId} compact={true} />
          )}
        </div>

        {/* Tags — compact */}
        {Array.isArray(tags) && tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {tags.slice(0, 2).map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded-md px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200 truncate max-w-[80px] sm:max-w-none"
                title={tag}
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="rounded-md px-2 py-0.5 text-xs font-medium bg-gray-700 text-gray-200" title={tags.slice(2).join(', ')}>
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>


    </div>

  )
}
