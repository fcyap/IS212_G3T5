"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Bell, User, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notificationService, userService } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"

const NotificationItem = ({ notification, sender }) => {
  console.log('NotificationItem received:', notification)

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
      case 'invitation': return 'bg-blue-100 dark:bg-blue-600 text-blue-800 dark:text-white border-blue-300 dark:border-blue-600'
      case 'comment': return 'bg-green-100 dark:bg-green-600 text-green-800 dark:text-white border-green-300 dark:border-green-600'
      case 'task_assignment': return 'bg-indigo-100 dark:bg-indigo-600 text-indigo-800 dark:text-white border-indigo-300 dark:border-indigo-600'
      case 'reassignment': return 'bg-purple-100 dark:bg-purple-600 text-purple-800 dark:text-white border-purple-300 dark:border-purple-600'
      case 'remove_from_task': return 'bg-red-100 dark:bg-red-600 text-red-800 dark:text-white border-red-300 dark:border-red-600'
      case 'task_deletion': return 'bg-amber-100 dark:bg-amber-600 text-amber-800 dark:text-white border-amber-300 dark:border-amber-600'
      case 'test': return 'bg-yellow-100 dark:bg-yellow-600 text-yellow-800 dark:text-white border-yellow-300 dark:border-yellow-600'
      case 'general': return 'bg-purple-100 dark:bg-purple-600 text-purple-800 dark:text-white border-purple-300 dark:border-purple-600'
      default: return 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-white border-gray-300 dark:border-gray-600'
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
    <div className="rounded-lg p-4 sm:p-6 border transition-all duration-200" style={{ backgroundColor: 'rgb(var(--card))', borderColor: 'rgb(var(--border))' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--muted))'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--card))'}>
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
        {/* Sender Avatar */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
          {senderInitials}
        </div>

        {/* Notification Content */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 sm:mb-3 gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h3 className="font-semibold text-sm sm:text-base" style={{ color: 'rgb(var(--foreground))' }}>
                {senderName}
              </h3>
              {notification.notif_types && (
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full border font-medium ${getTypeColor(notification.notif_types)}`}>
                  {getTypeLabel(notification.notif_types)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-shrink-0" style={{ color: 'rgb(var(--muted-foreground))' }}>
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="whitespace-nowrap">{formatFullDateTime(notification.created_at)}</span>
            </div>
          </div>

          <p className="text-sm sm:text-base leading-relaxed break-words" style={{ color: 'rgb(var(--muted-foreground))' }}>
            {notification.message}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [senders, setSenders] = useState({}) // Map of creator_id -> user data
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

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

      // Fetch all unique senders in one batch
      const uniqueCreatorIds = [...new Set(userNotifications.map(n => n.creator_id).filter(Boolean))]
      if (uniqueCreatorIds.length > 0) {
        try {
          const allUsers = await userService.getAllUsers()
          const sendersMap = {}
          uniqueCreatorIds.forEach(creatorId => {
            const sender = allUsers.find(u => u.id === creatorId)
            if (sender) {
              sendersMap[creatorId] = sender
            }
          })
          setSenders(sendersMap)
        } catch (err) {
          console.error('Failed to fetch senders:', err)
        }
      }
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

  useEffect(() => {
    if (user?.email) {
      fetchNotifications()
    }
  }, [user?.email]) // Only depend on email, not the function or entire user object

  useEffect(() => {
    if (!user?.email) return

    // Auto-refresh every 30 seconds (less aggressive)
    const interval = setInterval(() => {
      fetchNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [user?.email]) // Only depend on email

  // Show loading state while checking authentication (after all hooks)
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'rgb(var(--background))' }}>
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: 'rgb(var(--foreground))', borderTopColor: 'transparent' }}></div>
          <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading...</p>
        </div>
      </div>
    )
  }

  // Return null if not authenticated (will be redirected by SessionProvider)
  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: 'rgb(var(--background))', color: 'rgb(var(--foreground))' }}>
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="p-1.5 sm:p-2 rounded-full transition-colors"
            style={{ color: 'rgb(var(--muted-foreground))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
              e.currentTarget.style.color = 'rgb(var(--foreground))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
            }}
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3">
            <Bell className="w-6 h-6 sm:w-8 sm:h-8" style={{ color: 'rgb(var(--foreground))' }} />
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'rgb(var(--foreground))' }}>Notifications</h1>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: 'rgb(var(--foreground))', borderTopColor: 'transparent' }}></div>
                <p style={{ color: 'rgb(var(--muted-foreground))' }}>Loading notifications...</p>
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
              <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgb(var(--muted-foreground))' }} />
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--foreground))' }}>No notifications yet</h2>
              <p style={{ color: 'rgb(var(--muted-foreground))' }}>You&apos;ll see notifications here when you receive them.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
                <p className="text-sm sm:text-base" style={{ color: 'rgb(var(--muted-foreground))' }}>
                  {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                </p>
                <Button
                  onClick={fetchNotifications}
                  variant="outline"
                  className="w-full sm:w-auto"
                  style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--muted-foreground))' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgb(var(--muted))';
                    e.currentTarget.style.color = 'rgb(var(--foreground))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'rgb(var(--muted-foreground))';
                  }}
                >
                  Refresh
                </Button>
              </div>
              
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.notif_id}
                  notification={notification}
                  sender={senders[notification.creator_id] || null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
