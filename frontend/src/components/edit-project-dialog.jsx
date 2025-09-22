"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProjects } from "@/contexts/project-context"
import toast from "react-hot-toast"

export function EditProjectDialog({ project, isOpen, onClose }) {
  const { updateProject } = useProjects()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "active"
  })
  const [isLoading, setIsLoading] = useState(false)

  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "hold", label: "On Hold" },
    { value: "archived", label: "Archived" },
    { value: "completed", label: "Completed" }
  ]

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        description: project.description || "",
        status: project.status || "active"
      })
    }
  }, [project])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!project) return

    setIsLoading(true)
    try {
      await updateProject(project.id, {
        name: formData.name,
        description: formData.description,
        status: formData.status
      })
      onClose()
      toast.success("Project updated successfully!")
    } catch (error) {
      console.error("Failed to update project:", error)
      toast.error("Failed to update project. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="[&>[data-radix-dialog-overlay]]:animate-none [&>[data-radix-dialog-overlay]]:duration-0">
        <DialogContent className="sm:max-w-[425px] bg-[#1f1f23] border-gray-700 duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Project Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-gray-300">
                Project Name
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="bg-gray-700 border-gray-600 text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium text-gray-300">
                Description
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="bg-gray-700 border-gray-600 text-white min-h-[100px]"
                placeholder="Enter project description..."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium text-gray-300">
                Project Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </div>
    </Dialog>
  )
}
