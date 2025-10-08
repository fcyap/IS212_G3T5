"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { notificationService } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { Clock, AlertTriangle, X } from "lucide-react"

export function DeadlineNotificationToaster() {
  const { user } = useAuth()
  const router = useRouter()
  const [lastChecked, setLastChecked] = useState(null)
  const [dismissedNotifications, setDismissedNotifications] = useState(new Set())

  // Load dismissed notifications from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('dismissedDeadlineNotifications')
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
      localStorage.setItem('dismissedDeadlineNotifications', JSON.stringify(dismissedArray))
      console.log('Successfully saved to localStorage')
      
      // Verify it was saved
      const verification = localStorage.getItem('dismissedDeadlineNotifications')
      console.log('Verification - localStorage now contains:', verification)
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }, [dismissedNotifications])

  useEffect(() => {
    if (!user?.email) return

    // Check for new deadline notifications every 30 seconds
    const interval = setInterval(checkForDeadlineNotifications, 30000)

    // Initial check
    checkForDeadlineNotifications()

    return () => clearInterval(interval)
  }, [user?.email])

  const checkForDeadlineNotifications = async () => {
    if (!user?.email) return

    try {
      const data = await notificationService.getUserNotifications(10, 0)
      console.log('Raw notifications data:', data.notifications.slice(0, 3)) // Log first 3 notifications
            const deadlineNotifications = data.notifications.filter(notification => {
        // Check if notification is for current user and is a deadline notification
        if (!notification.recipient_emails) return false
        const recipients = notification.recipient_emails.split(',').map(email => email.trim())
        const isForUser = recipients.includes(user.email)
        const isDeadline = notification.notif_types === 'deadline'
        const notificationId = notification.notif_id || notification.id
        
        // Ensure consistent types - convert to number for comparison
        const normalizedId = Number(notificationId)
        const isDismissed = dismissedNotifications.has(normalizedId)

        console.log('Filtering notification:', {
          id: normalizedId,
          isForUser,
          isDeadline,
          isDismissed,
          dismissedSet: [...dismissedNotifications],
          willShow: isForUser && isDeadline && !isDismissed
        })

        // Only show notifications that are for this user, are deadline type, and haven't been dismissed
        return isForUser && isDeadline && !isDismissed
      })

      console.log('Filtered deadline notifications:', deadlineNotifications.length)

      // Show toast for each new deadline notification
      deadlineNotifications.forEach(notification => {
        console.log('Showing toast for notification:', {
          id: notification.notif_id,
          id_alt: notification.id,
          all_keys: Object.keys(notification)
        })
        showDeadlineToast(notification)
      })

      // Update last checked time
      if (deadlineNotifications.length > 0) {
        setLastChecked(new Date())
      }

    } catch (error) {
      console.error('Error checking for deadline notifications:', error)
    }
  }

  const showDeadlineToast = (notification) => {
    // Determine urgency based on message content
    const isToday = notification.message.includes('due TODAY')
    const isTomorrow = notification.message.includes('due TOMORROW')
    
    let urgencyIcon = <Clock className="w-6 h-6" />
    let urgencyColor = 'text-orange-400'
    let bgGradient = 'from-orange-500/20 to-yellow-500/20'
    let borderColor = 'border-orange-400/40'

    if (isToday) {
      urgencyIcon = <AlertTriangle className="w-6 h-6" />
      urgencyColor = 'text-red-400'
      bgGradient = 'from-red-500/20 to-red-600/20'
      borderColor = 'border-red-400/40'
    }

    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-sm w-full bg-gradient-to-r ${bgGradient} backdrop-blur-sm border-2 ${borderColor} shadow-2xl rounded-xl pointer-events-auto transform transition-all duration-300 hover:scale-105`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className={`flex-shrink-0 ${urgencyColor} drop-shadow-lg`}>
                {urgencyIcon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-bold text-white drop-shadow-sm">
                    📅 Task Deadline
                  </p>
                  {isToday && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                      URGENT
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-white/90 font-medium leading-relaxed">
                  {notification.message.split('\n')[0]}
                </div>
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