"use client"
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
  ChevronDown,
  Edit,
} from "lucide-react"
import { useProjects } from "@/contexts/project-context"
import { EditProjectDialog } from "./edit-project-dialog"

export function ProjectHeader() {
  const { selectedProject } = useProjects()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  return (
    <div className="bg-[#1f1f23] text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Menu className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
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
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Settings className="w-4 h-4" />
          </Button>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-yellow-500 text-black text-sm font-medium">WK</AvatarFallback>
          </Avatar>
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
              {selectedProject ? selectedProject.name : "Select a Project"}
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
                  <div className="absolute top-full left-0 mt-1 bg-[#1f1f23] border border-gray-600 rounded-md shadow-lg z-10 min-w-[160px]">
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
                <AvatarFallback className="bg-orange-500 text-white text-xs">A</AvatarFallback>
              </Avatar>
              <Avatar className="w-8 h-8 border-2 border-gray-700">
                <AvatarFallback className="bg-pink-500 text-white text-xs">T</AvatarFallback>
              </Avatar>
              <div className="w-8 h-8 bg-gray-600 rounded-full border-2 border-gray-700 flex items-center justify-center text-xs text-gray-300">
                +2
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <List className="w-4 h-4 mr-2" />
            List
          </Button>
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <LayoutGrid className="w-4 h-4 mr-2" />
            Board
          </Button>
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </Button>
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Timeline
          </Button>
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <Workflow className="w-4 h-4 mr-2" />
            Workflow
          </Button>
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <MessageSquare className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button variant="ghost" className="text-gray-400 hover:text-white">
            <Files className="w-4 h-4 mr-2" />
            Docs
          </Button>
        </div>
      </div>

      {/* Edit Project Dialog */}
      {showEditDialog && selectedProject && (
        <EditProjectDialog
          project={selectedProject}
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
        />
      )}
    </div>
  )
}
