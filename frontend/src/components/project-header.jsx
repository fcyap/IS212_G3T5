"use client"
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
} from "lucide-react"

export function ProjectHeader() {
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
            <h1 className="text-xl font-semibold">Software Project Management (SPM)</h1>
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
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <Button className="bg-gray-700 hover:bg-gray-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add task
          </Button>

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
    </div>
  )
}

function NavTab({ icon: Icon, label, isActive }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-3 text-sm cursor-pointer border-b-2 transition-colors ${isActive ? "border-blue-500 text-white" : "border-transparent text-gray-400 hover:text-white"
        }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
  )
}
