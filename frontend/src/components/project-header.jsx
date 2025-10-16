"use client"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Search,
  Star,
  Circle,
  List,
  LayoutGrid,
  Calendar,
  BarChart3,
  Workflow,
  MessageSquare,
  Files,
  Plus,
  Filter,
  ArrowUpDown,
  Group,
  Settings,
  Share,
  Palette,
  Menu,
  HelpCircle,
  ArchiveRestore,
  ChevronDown,
  Edit,
} from "lucide-react"

import { useKanban } from "@/components/kanban-context"
import { useProjects } from "@/contexts/project-context"
import { useAuth } from "@/hooks/useAuth"
import { EditProjectDialog } from "./edit-project-dialog"
import { CreateProjectDialog } from "./create-project"
import { NotificationBell } from "./notification-bell"

export function ProjectHeader({ currentView }) {
  const { startAddTask } = useKanban()
  const { selectedProject } = useProjects()
  const { canEditProject, user } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  const displayName = user?.name || user?.email || 'Unknown User'
  const initials = (user?.name || user?.email || 'U')
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const roleLabel = (user?.role?.label || user?.role_label || user?.role || 'No Role').replace(/^./, c => c.toUpperCase())

  return (
    <div className="bg-[#1f1f23] text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
        <div className="flex items-center gap-4">
          {/* <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Menu className="w-4 h-4" />
          </Button> */}

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full"></div>
            </div>
            <span className="text-lg font-semibold">G3T5</span>
          </div>
        </div>

        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search smu.edu.sg"
              className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CreateProjectDialog>
            <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </CreateProjectDialog>
          <NotificationBell />
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Settings className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3 bg-[#23232a] px-3 py-2 rounded-lg border border-white/10">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-blue-500 text-white text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">{displayName}</span>
              <span className="text-xs text-gray-400">{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Header */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500 rounded flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold">
              {selectedProject ? selectedProject.name : "Software Project Management (SPM)"}
            </h1>
            {selectedProject && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white p-1"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                {showDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-[#1f1f23] border border-gray-600 rounded-md shadow-lg z-10 min-w-[200px]">
                    {canEditProject(selectedProject?.creator_id) ? (
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2"
                        onClick={() => {
                          setShowEditDialog(true)
                          setShowDropdown(false)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        Edit Project Details
                      </button>
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                        <Edit className="w-4 h-4" />
                        <span>Edit Project Details</span>
                        <span className="text-xs">(Creator only)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Star className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Circle className="w-3 h-3" />
              <span>Set status</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <Avatar className="w-8 h-8 border-2 border-gray-700">
                <AvatarFallback className="bg-purple-500 text-white text-xs">Y</AvatarFallback>
              </Avatar>
              <Avatar className="w-8 h-8 border-2 border-gray-700">
                <AvatarFallback className="bg-yellow-500 text-black text-xs">WK</AvatarFallback>
              </Avatar>
              <Avatar className="w-8 h-8 border-2 border-gray-700">
                <AvatarFallback className="bg-blue-500 text-white text-xs">A</AvatarFallback>
              </Avatar>
              <Avatar className="w-8 h-8 border-2 border-gray-700">
                <AvatarFallback className="bg-pink-500 text-white text-xs">T</AvatarFallback>
              </Avatar>
              <div className="w-8 h-8 bg-gray-600 rounded-full border-2 border-gray-700 flex items-center justify-center text-xs text-gray-300">
                +2
              </div>
            </div>

            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>

            <Button className="bg-gray-700 hover:bg-gray-600 text-white">
              <Palette className="w-4 h-4 mr-2" />
              Customize
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 border-b border-gray-700">
          <NavTab icon={List} label="Overview" />
          <NavTab icon={List} label="List" />
          <NavTab icon={LayoutGrid} label="Board" isActive />
          <NavTab icon={Calendar} label="Timeline" />
          <NavTab icon={BarChart3} label="Dashboard" />
          <NavTab icon={Calendar} label="Calendar" />
          <NavTab icon={Workflow} label="Workflow" />
          <NavTab icon={MessageSquare} label="Messages" />
          <NavTab icon={Files} label="Files" />
          <NavTab icon={ArchiveRestore} label="Archive" href="archive"/>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {currentView !== 'projects' && (
            <Button onClick={() => startAddTask("top", "pending")} className="bg-gray-700 hover:bg-gray-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add task
            </Button>
          )}

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <ArrowUpDown className="w-4 h-4 mr-2" />
              Sort
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Group className="w-4 h-4 mr-2" />
              Group
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Settings className="w-4 h-4 mr-2" />
              Options
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Project Dialog */}
      {showEditDialog && selectedProject && (
        <EditProjectDialog
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          project={selectedProject}
        />
      )}
    </div>
  )
}

function NavTab({ icon: Icon, label, isActive, href }) {
  const base =
    "flex items-center gap-2 px-3 py-3 text-sm cursor-pointer border-b-2 transition-colors"
  const active = isActive
    ? "border-blue-500 text-white"
    : "border-transparent text-gray-400 hover:text-white"

  const className = `${base} ${active}`

  if (href) {
    return (
      <Link href={href} className={className}>
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <div className={className}>
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
  )
}