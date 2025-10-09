"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { notificationService } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import {
  Clock,
  AlertTriangle,
  X,
  Mail,
  MessageCircle,
  UserPlus,
  UserMinus,
  RefreshCcw
} from "lucide-react"

export function DeadlineNotificationToaster() {
  const { user } = useAuth()
  const router = useRouter()
  const [lastChecked, setLastChecked] = useState(null)
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set())

  // Load dismissed notifications from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('dismissedInAppNotifications')
    if (stored) {
      try {
        const dismissedIds = JSON.parse(stored)
        // Ensure all IDs are numbers for consistent comparison
        const normalizedIds = dismissedIds.map(id => Number(id))
        console.log('Loading dismissed IDs from localStorage:', normalizedIds)
        setDismissedNotifications(new Set(normalizedIds))
      } catch (error) {
        console.error('Error parsing dismissed notifications:', error)
      }
    }
  }, [])

  // Save dismissed notifications to localStorage whenever it changes
  useEffect(() => {
    // Don't save on initial empty set to avoid overwriting existing data
    if (dismissedNotifications.size === 0) {
      console.log('Skipping save - empty dismissed set (probably initial state)')
      return
    }
    
    const dismissedArray = [...dismissedNotifications]
    console.log('Saving dismissed notifications to localStorage:', dismissedArray)
    
    try {
      localStorage.setItem('dismissedInAppNotifications', JSON.stringify(dismissedArray))
      console.log('Successfully saved to localStorage')
      
      // Verify it was saved
      const verification = localStorage.getItem('dismissedInAppNotifications')
      console.log('Verification - localStorage now contains:', verification)
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }, [dismissedNotifications])

  useEffect(() => {
    if (!user?.email) return

    // Check for new deadline notifications every 30 seconds
    const interval = setInterval(checkForNotifications, 30000)

    // Initial check
    checkForNotifications()

    return () => clearInterval(interval)
  }, [user?.email])

  const checkForNotifications = async () => {
    if (!user?.email) return

    try {
      const data = await notificationService.getUserNotifications(10, 0)
      console.log('Raw notifications data:', data.notifications.slice(0, 3)) // Log first 3 notifications
      const eligibleTypes = new Set([
        'deadline',
        'task_assignment',
        'reassignment',
        'remove_from_task',
        'comment',
        'invitation',
        'general'
      ])

      const relevantNotifications = data.notifications.filter(notification => {
        if (!notification.recipient_emails) return false
        const recipients = notification.recipient_emails.split(',').map(email => email.trim())
        const isForUser = recipients.includes(user.email)
        const notifType = notification.notif_types || 'general'
        const isEligible = eligibleTypes.has(notifType)
        const notificationId = notification.notif_id || notification.id
        
        // Ensure consistent types - convert to number for comparison
        const normalizedId = Number(notificationId)
        const isDismissed = dismissedNotifications.has(normalizedId)

        console.log('Filtering notification:', {
          id: normalizedId,
          isForUser,
          notifType,
          isEligible,
          isDismissed,
          dismissedSet: [...dismissedNotifications],
          willShow: isForUser && isEligible && !isDismissed
        })

        // Only show notifications that are for this user, match eligible types, and haven't been dismissed
        return isForUser && isEligible && !isDismissed
      })

      console.log('Filtered deadline notifications:', relevantNotifications.length)

      // Show toast for each new deadline notification
      relevantNotifications.forEach(notification => {
        console.log('Showing toast for notification:', {
          id: notification.notif_id,
          id_alt: notification.id,
          all_keys: Object.keys(notification)
        })
        showNotificationToast(notification)
      })

      // Update last checked time
      if (relevantNotifications.length > 0) {
        setLastChecked(new Date())
      }

    } catch (error) {
      console.error('Error checking for notifications:', error)
    }
  }

  const TOAST_THEME = {
    deadline: {
      title: '📅 Task Deadline',
      icon: (isToday) => (isToday ? <AlertTriangle className="w-6 h-6" /> : <Clock className="w-6 h-6" />),
      color: (isToday) => (isToday ? 'text-red-400' : 'text-orange-400'),
      gradient: (isToday) => (isToday ? 'from-red-500/20 to-red-600/20' : 'from-orange-500/20 to-yellow-500/20'),
      border: (isToday) => (isToday ? 'border-red-400/40' : 'border-orange-400/40'),
      showUrgentBadge: (isToday) => isToday
    },
    task_assignment: {
      title: '✅ Task Assignment',
      icon: () => <UserPlus className="w-6 h-6" />,
      color: () => 'text-emerald-400',
      gradient: () => 'from-emerald-500/20 to-teal-500/20',
      border: () => 'border-emerald-400/40'
    },
    reassignment: {
      title: '🔁 Task Reassigned',
      icon: () => <RefreshCcw className="w-6 h-6" />,
      color: () => 'text-indigo-400',
      gradient: () => 'from-indigo-500/20 to-blue-500/20',
      border: () => 'border-indigo-400/40'
    },
    remove_from_task: {
      title: '🚫 Removed From Task',
      icon: () => <UserMinus className="w-6 h-6" />,
      color: () => 'text-red-400',
      gradient: () => 'from-rose-500/20 to-red-500/20',
      border: () => 'border-rose-400/40'
    },
    comment: {
      title: '💬 New Comment',
      icon: () => <MessageCircle className="w-6 h-6" />,
      color: () => 'text-sky-400',
      gradient: () => 'from-sky-500/20 to-blue-500/20',
      border: () => 'border-sky-400/40'
    },
    invitation: {
      title: '📨 Project Invitation',
      icon: () => <Mail className="w-6 h-6" />,
      color: () => 'text-purple-400',
      gradient: () => 'from-purple-500/20 to-pink-500/20',
      border: () => 'border-purple-400/40'
    },
    general: {
      title: '🔔 Notification',
      icon: () => <Mail className="w-6 h-6" />,
      color: () => 'text-gray-200',
      gradient: () => 'from-gray-500/20 to-slate-500/20',
      border: () => 'border-gray-400/40'
    }
  }

  const showNotificationToast = (notification) => {
    const notifType = notification.notif_types || 'general'
    const theme = TOAST_THEME[notifType] || TOAST_THEME.general
    const messageLines = notification.message ? notification.message.split('\n').filter(Boolean) : []

    // Determine urgency for deadlines
    const isDeadline = notifType === 'deadline'
    const isToday = isDeadline && notification.message.includes('due TODAY')
    const iconElement = theme.icon(isToday)
    const colorClass = theme.color(isToday)
    const gradientClass = theme.gradient(isToday)
    const borderClass = theme.border(isToday)
    const showUrgentBadge = theme.showUrgentBadge ? theme.showUrgentBadge(isToday) : false

    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-sm w-full bg-gradient-to-r ${gradientClass} backdrop-blur-sm border-2 ${borderClass} shadow-2xl rounded-xl pointer-events-auto transform transition-all duration-300 hover:scale-105`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 ${colorClass} drop-shadow-lg`}>
                {iconElement}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-bold text-white drop-shadow-sm">
                    {theme.title}
                  </p>
                  {showUrgentBadge && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                      URGENT
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-white/90 font-medium leading-relaxed">
                  {messageLines.length > 0 ? messageLines[0] : notification.message}
                </div>
                {messageLines.slice(1).map((line, index) => (
                  <div key={index} className="text-xs text-white/80 mt-1 leading-relaxed whitespace-pre-line">
                    {line}
                  </div>
                ))}
                {!notification.read && (
                  <button
                    className="mt-3 text-xs text-white/70 underline hover:text-white transition-colors"
                    onClick={() => {
                      router.push('/notifications')
                      toast.dismiss(t.id)
                    }}
                  >
                    View all notifications
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                console.log('Dismissing notification:', {
                  notif_id: notification.notif_id,
                  id: notification.id,
                  all_keys: Object.keys(notification)
                })
                // Mark this notification as dismissed
                const notificationId = notification.notif_id || notification.id;
                const normalizedId = Number(notificationId)
                console.log('Dismissing notification:', {
                  originalId: notificationId,
                  normalizedId,
                  type: typeof normalizedId
                })
                setDismissedNotifications(prev => {
                  const newSet = new Set([...prev, normalizedId])
                  console.log('Updated dismissed set:', [...newSet])
                  console.log('Set size:', newSet.size)
                  return newSet
                })
                toast.dismiss(t.id)
              }}
              className="flex-shrink-0 ml-3 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    ), {
      duration: 5000, // Auto-dismiss after 5 seconds
      position: 'top-right',
    })
  }

  return null // This component doesn't render anything visible
}
