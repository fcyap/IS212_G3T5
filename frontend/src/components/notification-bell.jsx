"use client"

import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { notificationService } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"

export function NotificationBell() {
  const [notificationCount, setNotificationCount] = useState(0)
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      fetchNotificationCount()
    }
  }, [user])

  const fetchNotificationCount = async () => {
    if (!user?.email) return
    
    try {
      const data = await notificationService.getUserNotifications(50, 0)
      // Filter notifications to only show ones where user is a recipient
      const userNotifications = data.notifications.filter(notif => {
        if (!notif.recipient_emails) return false
        // Handle both single email and comma-separated emails
        const recipients = notif.recipient_emails.split(',').map(email => email.trim())
        return recipients.includes(user.email)
      })
      // Only count notifications that haven't been dismissed
      const undismissedCount = userNotifications.filter(notif => !notif.dismissed).length
      setNotificationCount(undismissedCount)
    } catch (err) {
      console.error('Failed to fetch notification count:', err)
      setNotificationCount(0)
    }
  }

  const handleClick = () => {
    router.push('/notifications')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="relative p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg"
    >
      <Bell className="w-5 h-5" />
      {notificationCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
          {notificationCount > 99 ? '99+' : notificationCount}
        </span>
      )}
    </Button>
  )
}