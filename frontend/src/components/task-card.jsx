"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Settings, CalendarDays, ArchiveRestore } from "lucide-react"
import { CommentSection } from "./task-comment/task-comment-section"
import { TaskAttachmentsDisplay } from "./task-attachments-display"

export function TaskCard({ title, priority, status, assignees = [], dateRange, description, deadline, onClick, tags = [], onUnarchive, taskId, viewMode = 'detailed' }) {

  const cap = (s) => (s ? s.toString().charAt(0).toUpperCase() + s.toString().slice(1).toLowerCase() : "")
  const p = Number(priority) || 5 // Priority is now 1-10
  const s = (status || "").toLowerCase()

  // Priority system: 1-10 integer scale with visual mapping
  const getPriorityLabel = (priority) => {
    const p = Number(priority);
    if (p >= 9) return "Critical";
    if (p >= 7) return "High";
    if (p >= 4) return "Medium";
    return "Low";
  };

  const priorityChipClasses = {
    1: "bg-slate-200 text-slate-800",
    2: "bg-slate-200 text-slate-800", 
    3: "bg-teal-200 text-teal-900",
    4: "bg-teal-200 text-teal-900",
    5: "bg-amber-200 text-amber-900",
    6: "bg-amber-300 text-amber-950",
    7: "bg-orange-300 text-orange-950",
    8: "bg-red-300 text-red-950",
    9: "bg-fuchsia-400 text-fuchsia-950",
    10: "bg-purple-500 text-white",
  };


  const a = assignees ?? {
    name: "",
    avatar: "",
    fallback: (title?.[0] ?? "?").toUpperCase(),
    color: "bg-gray-600",
  }

  const dueText = deadline || (dateRange ? dateRange.replace(/^Due\s*/i, "") : null)

  const getPriorityColor = () => {
    return priorityChipClasses[p] || "bg-gray-600 text-white";
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdue =
    (status === "pending" || status === "in_progress") &&
    deadline &&
    new Date(deadline) < today;

  const getCardClasses = () => {
    const baseClasses = "task-card border rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40 touch-manipulation"
    const statusClasses = isOverdue
      ? "bg-red-950/40 border-red-500"
      : ""

    const viewClasses = {
      compact: "p-2",
      detailed: "p-3 sm:p-4",
      grid: "p-3 sm:p-4"
    }

    return `${baseClasses} ${statusClasses} ${viewClasses[viewMode] || viewClasses.detailed}`
  }

  const shouldShowDetails = () => {
    return viewMode === 'detailed' || viewMode === 'grid'
  }

  const shouldShowDescription = () => {
    return viewMode === 'detailed' || viewMode === 'grid'
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={getCardClasses()}
      >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium break-words ${viewMode === 'compact' ? 'text-sm' : 'text-sm sm:text-base'}`}
            style={{ color: 'rgb(var(--foreground))' }}
          >
            {title}
          </h3>
          {shouldShowDescription() && description && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: 'rgb(var(--muted-foreground))' }}>{description}</p>
          )}
        </div>
        {onUnarchive ? (
          <button
            type="button"
            title="Unarchive"
            onClick={(e) => {
              e.stopPropagation();
              onUnarchive?.();
            }}
            className="p-2 rounded touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ color: 'rgb(var(--foreground))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <ArchiveRestore className="w-4 h-4" />
          </button>
        ) : (
          <Settings className="w-4 h-4" style={{ color: 'rgb(var(--muted-foreground))' }} />
        )}

      </div>

      {/* Badges */}
      {shouldShowDetails() && (
        <div className="mt-2 sm:mt-3 flex items-center gap-2 flex-wrap">
          {priority ? <Badge className={`text-xs px-2 py-1 ${getPriorityColor()}`}>
            {p}
          </Badge> : null}
        </div>
      )}

      {/* Compact view priority */}
      {viewMode === 'compact' && priority && (
        <div className="mt-1">
          <Badge className={`text-xs px-1 py-0.5 ${getPriorityColor()}`}>
            {p}
          </Badge>
        </div>
      )}


      {/* Avatar + Deadline + Tags */}
      {shouldShowDetails() && (
        <div className="mt-2 sm:mt-3 flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {assignees.length > 0 && (
              <div className="flex -space-x-2">
                {assignees.slice(0, 3).map((a, i) => (
                  <Avatar key={i} className="w-6 h-6 border-2" style={{ borderColor: 'rgb(var(--task-background))' }}>
                    <AvatarFallback className="text-xs font-medium" style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}>
                      {(a.name?.charAt(0) || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {assignees.length > 3 && (
                  <div className="w-6 h-6 rounded-full border-2 text-[10px] flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--muted))', borderColor: 'rgb(var(--task-background))', color: 'rgb(var(--foreground))' }}>
                    +{assignees.length - 3}
                  </div>
                )}
              </div>
            )}

            {dueText && (
              <span className="flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap" style={{ color: 'rgb(var(--muted-foreground))' }}>
                <CalendarDays className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">Due {dueText}</span>
              </span>
            )}

            {/* Attachment count */}
            {taskId && (
              <TaskAttachmentsDisplay taskId={taskId} compact={true} />
            )}
          </div>

          {/* Tags — compact, right aligned */}
          {Array.isArray(tags) && tags.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1">
            {tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="rounded-md px-2 py-0.5 text-xs font-medium truncate max-w-[80px] sm:max-w-none"
                style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}
                title={tag}
              >
                {tag}
              </span>
            ))}
            </div>
          )}
        </div>
      )}

      {/* Compact view assignees and deadline */}
      {viewMode === 'compact' && (
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {assignees.length > 0 && (
              <div className="flex -space-x-1">
                {assignees.slice(0, 2).map((a, i) => (
                  <Avatar key={i} className="w-4 h-4">
                    <AvatarFallback className="text-xs" style={{ backgroundColor: 'rgb(var(--muted))', color: 'rgb(var(--foreground))' }}>
                      {(a.name?.charAt(0) || "U").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {assignees.length > 2 && (
                  <span className="text-xs ml-1" style={{ color: 'rgb(var(--muted-foreground))' }}>+{assignees.length - 2}</span>
                )}
              </div>
            )}
          </div>
          {dueText && (
            <span className="text-xs" style={{ color: 'rgb(var(--muted-foreground))' }}>
              {dueText}
            </span>
          )}
        </div>
      )}

    </div>

  )
}
