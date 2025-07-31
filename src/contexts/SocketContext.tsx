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
  addTestNotification: () => void;
}

const SocketContext = createContext<SocketContextValue>({ 
  socket: null, 
  notifications: [], 
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  addTestNotification: () => {}
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      console.log("No token found, skipping socket connection");
      return;
    }

    const currentUserStr = sessionStorage.getItem("currentUser");
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    
    console.log("Attempting socket connection with:", {
      token: token ? "Token exists" : "No token",
      user: currentUser ? currentUser.name : "No user",
      socketUrl: SOCKET_URL
    });

    const s = io(SOCKET_URL, {
      auth: { 
        token,
        userId: currentUser?._id,
        userRole: currentUser?.role
      },
      transports: ["websocket"],
      withCredentials: true,
    });

    s.on("connect", () => {
      console.log("Socket connected successfully");
      toast.success("Connected to real-time updates");
      setSocket(s);
    });

    s.on("disconnect", () => {
      console.log("Socket disconnected");
      toast.error("Lost connection to real-time updates");
    });

    s.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    s.on("notification:new", (notification: Notification) => {
      console.log("Received notification:", notification);
      const newNotification = { ...notification, isRead: false };
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

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

    s.on("task:assigned", (data: any) => {
      toast.success(`Task "${data.task.title}" assigned to you`, {
        duration: 5000,
        icon: '📋',
      });
      
      const notification: Notification = {
        id: `task-assigned-${Date.now()}`,
        title: "New Task Assigned",
        message: `You have been assigned a new task: "${data.task.title}"`,
        type: 'info',
        priority: data.task.priority || 'medium',
        category: 'task',
        metadata: {
          taskId: data.task._id,
          projectId: data.project?._id,
          technicianId: data.technician?._id
        },
        createdAt: new Date().toISOString(),
        isRead: false
      };
      
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    s.on("task:completed", (data: any) => {
      toast.success(`Task "${data.task.title}" completed successfully`, {
        duration: 4000,
        icon: '✅',
      });
    });

    s.on("task:status_changed", (data: any) => {
      toast(`Task "${data.task.title}" status updated to "${data.status}"`, {
        duration: 4000,
        icon: '📝',
      });
    });

    s.on("task:overdue", (data: any) => {
      toast.error(`Task "${data.task.title}" is overdue!`, {
        duration: 8000,
        icon: '⏰',
      });
    });

    s.on("project:created", (data: any) => {
      toast.success(`New project "${data.project.siteName}" created`, {
        duration: 4000,
        icon: '🏗️',
      });
    });

    s.on("project:updated", (data: any) => {
      toast(`Project "${data.project.siteName}" updated`, {
        duration: 4000,
        icon: '📝',
      });
    });

    s.on("user:login", (data: any) => {
      toast(`${data.user.name} logged in`, {
        duration: 3000,
        icon: '👤',
      });
    });

    s.on("system:maintenance", (data: any) => {
      toast(data.message, {
        duration: 8000,
        icon: '🔧',
        style: {
          background: '#3b82f6',
          color: 'white',
        },
      });
    });

    s.on("system:alert", (data: any) => {
      toast.error(data.message, {
        duration: 10000,
        icon: '🚨',
      });
    });

    return () => {
      s.disconnect();
    };
  }, []);

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
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const addTestNotification = () => {
    const testNotification: Notification = {
      id: `test-${Date.now()}`,
      title: "Test Notification",
      message: "This is a test notification to verify the system is working",
      type: 'info',
      priority: 'medium',
      category: 'general',
      createdAt: new Date().toISOString(),
      isRead: false
    };
    
    console.log("Adding test notification:", testNotification);
    setNotifications(prev => [testNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      notifications, 
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      addTestNotification
    }}>
      {children}
    </SocketContext.Provider>
  );
}; 