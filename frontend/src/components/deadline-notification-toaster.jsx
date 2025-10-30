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
  RefreshCcw,
  Trash2
  RefreshCcw,
  Trash2
} from "lucide-react"

export function DeadlineNotificationToaster() {
  const { user } = useAuth()
  const router = useRouter()
  const [lastChecked, setLastChecked] = useState(null)
  const [shownNotifications, setShownNotifications] = useState(new Set())
  const [shownNotifications, setShownNotifications] = useState(new Set())

  useEffect(() => {
    if (!user?.email) return

    // Check for new deadline notifications every 5 seconds (temporarily for testing)
    const interval = setInterval(checkForNotifications, 5000)
    // Check for new deadline notifications every 5 seconds (temporarily for testing)
    const interval = setInterval(checkForNotifications, 5000)

    // Initial check
    checkForNotifications()

    return () => clearInterval(interval)
  }, [user?.email])

  const checkForNotifications = async () => {
    if (!user?.email) {
      console.log('No user email, skipping notification check');
      return;
    }

    console.log('Checking for notifications for user:', user.email);
    if (!user?.email) {
      console.log('No user email, skipping notification check');
      return;
    }

    console.log('Checking for notifications for user:', user.email);

    try {
      // Fetch only non-dismissed notifications for toaster display
      const data = await notificationService.getUserNotifications(10, 0, false)
      console.log('Raw notifications data:', data.notifications.slice(0, 5)) // Log first 5 notifications
      console.log('Raw notifications data:', data.notifications.slice(0, 5)) // Log first 5 notifications
      const eligibleTypes = new Set([
        'deadline',
        'task_assignment',
        'reassignment',
        'remove_from_task',
        'comment',
        'invitation',
        'task_deletion',
        'overdue',
        'general'
      ])

      const relevantNotifications = data.notifications.filter(notification => {
        if (!notification.recipient_emails) {
          console.log('Notification missing recipient_emails:', notification.notif_id);
          return false;
        }
        if (!notification.recipient_emails) {
          console.log('Notification missing recipient_emails:', notification.notif_id);
          return false;
        }
        const recipients = notification.recipient_emails.split(',').map(email => email.trim())
        const isForUser = recipients.includes(user.email)
        const notifType = notification.notif_types || 'general'
        const isEligible = eligibleTypes.has(notifType)

        console.log('Filtering notification:', {
          id: notification.notif_id,
          type: notifType,
          recipient_emails: notification.recipient_emails,
          userEmail: user.email,
          type: notifType,
          recipient_emails: notification.recipient_emails,
          userEmail: user.email,
          isForUser,
          isEligible,
          dismissed: notification.dismissed,
          willShow: isForUser && isEligible,
          message: notification.message?.substring(0, 50) + '...'
          willShow: isForUser && isEligible,
          message: notification.message?.substring(0, 50) + '...'
        })

        // Only show notifications that are for this user and match eligible types
        // Backend already filtered out dismissed notifications
        return isForUser && isEligible
      })

      console.log('Total notifications from API:', data.notifications.length)
      console.log('Total notifications from API:', data.notifications.length)
      console.log('Filtered notifications:', relevantNotifications.length)
      console.log('Eligible types:', Array.from(eligibleTypes))
      console.log('Eligible types:', Array.from(eligibleTypes))

      // Show toast for each new notification that hasn't been shown yet
      // Show toast for each new notification that hasn't been shown yet
      relevantNotifications.forEach(notification => {
        const notificationId = notification.notif_id || notification.id
        
        // Only show if we haven't shown this notification before
        if (!shownNotifications.has(notificationId)) {
          console.log('Showing toast for notification:', {
            id: notificationId,
            type: notification.notif_types,
            message: notification.message
          })
          showNotificationToast(notification)
          
          // Mark this notification as shown
          setShownNotifications(prev => new Set([...prev, notificationId]))
        } else {
          console.log('Skipping already shown notification:', notificationId)
        }
        const notificationId = notification.notif_id || notification.id
        
        // Only show if we haven't shown this notification before
        if (!shownNotifications.has(notificationId)) {
          console.log('Showing toast for notification:', {
            id: notificationId,
            type: notification.notif_types,
            message: notification.message
          })
          showNotificationToast(notification)
          
          // Mark this notification as shown
          setShownNotifications(prev => new Set([...prev, notificationId]))
        } else {
          console.log('Skipping already shown notification:', notificationId)
        }
      })

      // Update last checked time
      if (relevantNotifications.length > 0) {
        setLastChecked(new Date())
      }

    } catch (error) {
      console.error('Error checking for notifications:', error)
    }
  }

  const handleDismiss = async (notification, toastId) => {
    const notificationId = notification.notif_id || notification.id
    console.log('Dismissing notification:', notificationId)

    try {
      // Call API to mark notification as dismissed
      await notificationService.dismissNotification(notificationId)
      console.log('Successfully dismissed notification:', notificationId)
      
      // Remove from shown notifications set so it doesn't stay in memory forever
      setShownNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
      
      // Remove from shown notifications set so it doesn't stay in memory forever
      setShownNotifications(prev => {
        const newSet = new Set(prev)
        newSet.delete(notificationId)
        return newSet
      })
      
      // Dismiss the toast
      toast.dismiss(toastId)
    } catch (error) {
      console.error('Error dismissing notification:', error)
      // Still dismiss the toast even if API call fails
      toast.dismiss(toastId)
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
    task_deletion: {
      title: '🗑️ Task Deleted',
      icon: () => <Trash2 className="w-6 h-6" />,
      color: () => 'text-amber-400',
      gradient: () => 'from-amber-500/20 to-orange-500/20',
      border: () => 'border-amber-400/40'
    },
    overdue: {
      title: '⚠️ Task Overdue',
      icon: () => <AlertTriangle className="w-6 h-6" />,
      color: () => 'text-red-500',
      gradient: () => 'from-red-600/30 to-red-700/30',
      border: () => 'border-red-500/50',
      showUrgentBadge: () => true
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
    const notificationId = notification.notif_id || notification.id
    const notificationId = notification.notif_id || notification.id

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
              onClick={() => handleDismiss(notification, t.id)}
              className="flex-shrink-0 ml-3 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    ), {
      id: `notification-${notificationId}`, // Use unique ID to prevent duplicates
      id: `notification-${notificationId}`, // Use unique ID to prevent duplicates
      duration: 5000, // Auto-dismiss after 5 seconds
      position: 'top-right',
    })
  }

  return null // This component doesn't render anything visible
}
