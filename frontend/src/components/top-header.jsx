"use client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Inbox } from "lucide-react"
import { useState } from "react"

export function TopHeader() {
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div className="bg-[#1f1f23] text-white border-b border-gray-700">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search projects, tasks, users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-700 relative">
            <Inbox className="w-5 h-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full"></span>
          </Button>
        </div>
      </div>
    </div>
  )
}
