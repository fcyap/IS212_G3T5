"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Bell, User, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notificationService, userService } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"

const NotificationItem = ({ notification }) => {
  console.log('NotificationItem received:', notification)
  const [sender, setSender] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSender = async () => {
      if (notification.creator_id) {
        try {
          const senderData = await userService.getUserById(notification.creator_id)
          setSender(senderData)
        } catch (error) {
          console.error('Failed to fetch sender:', error)
        }
      }
      setLoading(false)
    }

    fetchSender()
  }, [notification.creator_id])

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const notificationTime = new Date(timestamp)
    const diffInMs = now - notificationTime
    const diffInHours = diffInMs / (1000 * 60 * 60)
    const diffInDays = diffInHours / 24

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInDays < 7) {
      return `${Math.floor(diffInDays)}d ago`
    } else {
      return notificationTime.toLocaleDateString()
    }
  }

  const formatFullDateTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const senderName = sender?.name || sender?.email || 'System'
  const senderInitials = senderName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const getTypeColor = (type) => {
    switch (type) {
      case 'invitation': return 'bg-blue-600'
      case 'comment': return 'bg-green-600'
      case 'task_assignment': return 'bg-indigo-600'
      case 'reassignment': return 'bg-purple-600'
      case 'remove_from_task': return 'bg-red-600'
      case 'task_deletion': return 'bg-amber-600'
      case 'test': return 'bg-yellow-600'
      case 'general': return 'bg-purple-600'
      default: return 'bg-gray-600'
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'invitation': return 'Project Invitation'
      case 'comment': return 'New Comment'
      case 'task_assignment': return 'Task Assignment'
      case 'reassignment': return 'Task Reassignment'
      case 'remove_from_task': return 'Removed From Task'
      case 'task_deletion': return 'Task Deleted'
      case 'test': return 'Test'
      case 'general': return 'General'
      default: return type || 'Notification'
    }
  }

  return (
    <div className="bg-[#232326] rounded-lg p-6 border border-white/10 hover:bg-[#2a2a2d] transition-colors">
      <div className="flex items-start gap-4">
        {/* Sender Avatar */}
        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
          {loading ? <User className="w-6 h-6" /> : senderInitials}
        </div>
        
        {/* Notification Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-white">
                {loading ? 'Loading...' : senderName}
              </h3>
              {notification.notif_types && (
                <span className={`px-3 py-1 text-xs text-white rounded-full ${getTypeColor(notification.notif_types)}`}>
                  {getTypeLabel(notification.notif_types)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              {formatFullDateTime(notification.created_at)}
            </div>
          </div>
          
          <p className="text-gray-300 leading-relaxed">
            {notification.message}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      fetchNotifications()
      // Auto-refresh every 10 seconds
      const interval = setInterval(fetchNotifications, 10000)
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchNotifications = async () => {
    if (!user?.email) return

    setLoading(true)
    setError(null)
    
    try {
      const data = await notificationService.getUserNotifications(50, 0)
      console.log('Raw API response:', data)
      console.log('Notifications before filtering:', data.notifications)
      // Filter notifications to only show ones where user is a recipient
      const userNotifications = data.notifications.filter(notif => {
        if (!notif.recipient_emails) return false
        // Handle both single email and comma-separated emails
        const recipients = notif.recipient_emails.split(',').map(email => email.trim())
        return recipients.includes(user.email)
      })
      console.log('Filtered notifications:', userNotifications)
      setNotifications(userNotifications)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-[#1a1a1d] text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="p-2 hover:bg-white/10 rounded-full text-gray-300 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-white" />
            <h1 className="text-3xl font-bold text-white">Notifications</h1>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-300">Loading notifications...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-red-400">{error}</p>
                <Button 
                  onClick={fetchNotifications}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                >
                  Try Again
                </Button>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">No notifications yet</h2>
              <p className="text-gray-400">You'll see notifications here when you receive them.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <p className="text-gray-300">
                  {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                </p>
                <Button
                  onClick={fetchNotifications}
                  variant="outline"
                  className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  Refresh
                </Button>
              </div>
              
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.notif_id}
                  notification={notification}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
