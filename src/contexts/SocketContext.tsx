import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import toast from 'react-hot-toast';
import { SOCKET_URL, API_BASE_URL } from '@/config/environment';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'general' | 'security' | 'system' | 'task' | 'maintenance';
  metadata?: any;
  createdAt: string;
  isRead?: boolean;
}

interface SocketContextValue {
  socket: Socket | null;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const SocketContext = createContext<SocketContextValue>({ 
  socket: null, 
  notifications: [], 
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {}
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      withCredentials: true,
    });

    // Socket connection events
    s.on("connect", () => {
      console.log("Connected to server");
      toast.success("Connected to real-time updates");
    });

    s.on("disconnect", () => {
      console.log("Disconnected from server");
      toast.error("Lost connection to real-time updates");
    });

    // Real-time notification events
    s.on("notification:new", (notification: Notification) => {
      console.log("New notification received:", notification);
      
      // Add to notifications list with isRead: false
      const newNotification = { ...notification, isRead: false };
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show toast notification based on type
      switch (notification.type) {
        case 'success':
          toast.success(notification.message, {
            duration: 5000,
            icon: '✅',
          });
          break;
        case 'error':
          toast.error(notification.message, {
            duration: 6000,
            icon: '❌',
          });
          break;
        case 'warning':
          toast(notification.message, {
            duration: 5000,
            icon: '⚠️',
            style: {
              background: '#fbbf24',
              color: '#1f2937',
            },
          });
          break;
        case 'info':
          toast(notification.message, {
            duration: 4000,
            icon: 'ℹ️',
          });
          break;
        default:
          toast(notification.message, {
            duration: 4000,
            icon: '📢',
          });
      }
    });

    // Task-related notifications
    s.on("task:assigned", (data: any) => {
      toast.success(`Task "${data.task.title}" assigned to you`, {
        duration: 5000,
        icon: '📋',
      });
    });

    s.on("task:completed", (data: any) => {
      toast.success(`Task "${data.task.title}" completed successfully`, {
        duration: 4000,
        icon: '✅',
      });
    });

    s.on("task:overdue", (data: any) => {
      toast.error(`Task "${data.task.title}" is overdue!`, {
        duration: 8000,
        icon: '⏰',
      });
    });

    // Project-related notifications
    s.on("project:created", (data: any) => {
      toast.success(`New project "${data.project.siteName}" created`, {
        duration: 5000,
        icon: '🏗️',
      });
    });

    s.on("project:updated", (data: any) => {
      toast.info(`Project "${data.project.siteName}" has been updated`, {
        duration: 4000,
        icon: '📝',
      });
    });

    // User-related notifications
    s.on("user:login", (data: any) => {
      toast.success(`Welcome back, ${data.user.name}!`, {
        duration: 3000,
        icon: '👋',
      });
    });

    // System notifications
    s.on("system:maintenance", (data: any) => {
      toast(data.message, {
        duration: 8000,
        icon: '🔧',
        style: {
          background: '#f59e0b',
          color: '#1f2937',
        },
      });
    });

    s.on("system:alert", (data: any) => {
      toast.error(data.message, {
        duration: 10000,
        icon: '🚨',
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, isRead: true }
              : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Fallback: mark as read locally even if API call fails
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, isRead: true }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      // Fallback: mark all as read locally even if API call fails
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    }
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      notifications, 
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications
    }}>
      {children}
    </SocketContext.Provider>
  );
}; 