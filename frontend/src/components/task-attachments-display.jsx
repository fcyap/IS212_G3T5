"use client"

import { useState, useEffect } from 'react'
import { Paperclip, Download, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function TaskAttachmentsDisplay({ taskId, compact = false }) {
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!taskId) {
      setLoading(false)
      return
    }

    const fetchAttachments = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${API}/api/tasks/${taskId}/files`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch attachments')
        }

        const result = await response.json()
        console.log('Attachments API response:', result)
        setAttachments(result.data || [])
      } catch (err) {
        console.error('Error fetching attachments:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAttachments()
  }, [taskId])

  if (loading) {
    return compact ? null : (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading attachments...</span>
      </div>
    )
  }

  if (error || !attachments || attachments.length === 0) {
    return null
  }

  // Compact mode - just show count with icon
  if (compact) {
    return (
      <div className="flex items-center gap-1 text-gray-400 text-sm">
        <Paperclip className="w-4 h-4" />
        <span>{attachments.length}</span>
      </div>
    )
  }

  // Full mode - show list of attachments
  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400 block">
        Attachments ({attachments.length})
      </label>
      <div className="space-y-1">
        {attachments.map((file) => (
          <a
            key={file.id}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-md bg-gray-800 hover:bg-gray-700 transition-colors group"
          >
            <Paperclip className="w-4 h-4 text-gray-400" />
            <span className="flex-1 text-sm text-gray-300 truncate">
              {file.filename}
            </span>
            <Download className="w-4 h-4 text-gray-500 group-hover:text-blue-400 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}
