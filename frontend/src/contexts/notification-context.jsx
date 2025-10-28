"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { notificationService } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user?.email) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await notificationService.getUserNotifications(50, 0);

      // Filter notifications for current user
      const userNotifications = data.notifications.filter(notif => {
        if (!notif.recipient_emails) return false;
        const recipients = notif.recipient_emails.split(',').map(email => email.trim());
        return recipients.includes(user.email);
      });

      setNotifications(userNotifications);
      setUnreadCount(userNotifications.length); // Simplified - you may want to add a 'read' flag
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // Fetch notifications when user changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Auto-refresh every 2 minutes (less aggressive than before)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    refetch: fetchNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
