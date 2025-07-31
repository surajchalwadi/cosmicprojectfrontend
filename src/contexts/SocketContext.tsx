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
  testNotification: () => void;
}

const SocketContext = createContext<SocketContextValue>({ 
  socket: null, 
  notifications: [], 
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  testNotification: () => {}
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Load existing notifications
    const loadNotifications = async () => {
      try {
        console.log("🔄 Loading existing notifications...");
        const response = await fetch(`${API_BASE_URL}/notifications`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log("📋 Notifications loaded:", data);
          if (data.notifications) {
            setNotifications(data.notifications);
            const unread = data.notifications.filter((n: Notification) => !n.isRead).length;
            setUnreadCount(unread);
          }
        } else {
          console.log("⚠️ Notifications endpoint not available (status:", response.status, ")");
        }
      } catch (error) {
        console.log("⚠️ Notifications endpoint not available - continuing without existing notifications");
        // Don't show error toast - this is expected if endpoint doesn't exist
      }
    };

    // Load notifications immediately
    loadNotifications();

    // Get user info for socket authentication
    const currentUserStr = sessionStorage.getItem("currentUser");
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

    const s = io(SOCKET_URL, {
      auth: { 
        token,
        userId: currentUser?._id,
        userRole: currentUser?.role
      },
      transports: ["websocket"],
      withCredentials: true,
    });

    // Socket connection events
    s.on("connect", () => {
      console.log("✅ Connected to server");
      console.log("🔗 Socket ID:", s.id);
      console.log("🌐 Socket URL:", SOCKET_URL);
      console.log("👤 User Info:", { 
        userId: currentUser?._id, 
        userRole: currentUser?.role,
        hasToken: !!token 
      });
      toast.success("Connected to real-time updates");
    });

    s.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      toast.error("Lost connection to real-time updates");
    });

    s.on("connect_error", (error) => {
      console.log("🚨 Socket connection error:", error);
      console.log("🔍 Error details:", {
        message: error.message,
        name: error.name
      });
    });

    // Real-time notification events
    s.on("notification:new", (notification: Notification) => {
      console.log("New notification received:", notification);
      
      // Add to notifications list with isRead set to false
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
          });
      }
    });

    // Project updates
    s.on("project:created", (data: any) => {
      toast.success(`New project "${data.project.siteName}" created!`, {
        duration: 5000,
        icon: '🏗️',
      });
    });

    s.on("project:updated", (data: any) => {
      toast.success(`Project "${data.project.siteName}" updated!`, {
        duration: 4000,
        icon: '📝',
      });
    });

    s.on("project:status_changed", (data: any) => {
      toast(`Project "${data.project.siteName}" status changed to ${data.status}`, {
        duration: 4000,
        icon: '🔄',
      });
    });

    // Task updates
    s.on("task:assigned", (data: any) => {
      console.log("📋 Task assigned event received:", data);
      toast.success(`New task "${data.task.title}" assigned to you!`, {
        duration: 5000,
        icon: '📋',
      });
      
      // Add to notifications list
      const notification: Notification = {
        id: `task-assigned-${Date.now()}`,
        title: "New Task Assigned",
        message: `You have been assigned a new task: "${data.task.title}"`,
        type: 'info',
        priority: 'medium',
        category: 'task',
        metadata: {
          taskId: data.task._id,
          projectId: data.project?._id
        },
        createdAt: new Date().toISOString(),
        isRead: false
      };
      
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    s.on("task:updated", (data: any) => {
      console.log("✏️ Task updated event received:", data);
      toast(`Task "${data.task.title}" updated!`, {
        duration: 4000,
        icon: '✏️',
      });
    });

    s.on("task:status_changed", (data: any) => {
      console.log("🔄 Task status changed event received:", data);
      toast(`Task "${data.task.title}" status changed to ${data.status}`, {
        duration: 4000,
        icon: '🔄',
      });
    });

    s.on("task:completed", (data: any) => {
      toast.success(`Task "${data.task.title}" completed!`, {
        duration: 5000,
        icon: '✅',
      });
    });

    // Report updates
    s.on("report:submitted", (data: any) => {
      toast.success(`Report submitted for task "${data.report.task}"!`, {
        duration: 5000,
        icon: '📊',
      });
    });

    // User updates
    s.on("user:login", (data: any) => {
      toast(`User ${data.user.name} logged in`, {
        duration: 3000,
        icon: '👤',
      });
    });

    s.on("user:logout", (data: any) => {
      toast(`User ${data.user.name} logged out`, {
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

    // Test response from backend
    s.on("test:backend", (data: any) => {
      console.log("✅ Backend responded to test:", data);
      toast.success("Backend communication confirmed!", {
        duration: 3000,
        icon: '✅',
      });
    });

    // Listen for test events from backend
    s.on("test:task_assigned", (data: any) => {
      console.log("🧪 Test task assigned received:", data);
      toast.success("Test task assigned event received!", {
        duration: 3000,
        icon: '🧪',
      });
    });

    s.on("test:notification", (data: any) => {
      console.log("🧪 Test notification received:", data);
      toast.success("Test notification event received!", {
        duration: 3000,
        icon: '🧪',
      });
    });

    // Listen for connection acknowledgment from backend
    s.on("connection:acknowledged", (data: any) => {
      console.log("✅ Backend acknowledged connection:", data);
    });

    // Debug: Log all incoming events
    const originalEmit = s.emit;
    s.emit = function(event: string, ...args: any[]) {
      console.log("🔍 Frontend emitting:", event, args);
      return originalEmit.apply(this, [event, ...args]);
    };

    // Listen for common event variations (debugging)
    s.on("task_assigned", (data: any) => {
      console.log("🔍 Received task_assigned (underscore):", data);
    });
    
    s.on("task:assigned", (data: any) => {
      console.log("🔍 Received task:assigned (colon):", data);
    });
    
    s.on("notification", (data: any) => {
      console.log("🔍 Received notification (simple):", data);
    });

    setSocket(s);

    // Test socket communication after 2 seconds
    setTimeout(() => {
      console.log("🧪 Testing socket communication...");
      s.emit("test:frontend", { message: "Frontend is working!", timestamp: new Date().toISOString() });
      
      // Also test if backend responds to a simple ping
      s.emit("ping", { timestamp: new Date().toISOString() });
      
      // Test if backend emits any events
      console.log("🧪 Requesting backend to emit test events...");
      s.emit("request:test_events", { 
        events: ["task:assigned", "notification:new", "project:created"],
        timestamp: new Date().toISOString() 
      });
    }, 2000);

    // Set up periodic refresh of notifications (only if endpoint exists)
    // const refreshInterval = setInterval(loadNotifications, 30000); // Refresh every 30 seconds

    // Listen for test notifications
    const handleTestNotification = (event: CustomEvent) => {
      const notification = event.detail;
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show toast notification
      toast(notification.message, {
        duration: 4000,
        icon: '🧪',
      });
    };

    window.addEventListener('test-notification', handleTestNotification as EventListener);

    return () => {
      s.disconnect();
      // clearInterval(refreshInterval);
      window.removeEventListener('test-notification', handleTestNotification as EventListener);
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
    }
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  // Test notification function
  const testNotification = () => {
    const testNotif: Notification = {
      id: Date.now().toString(),
      title: "Test Notification",
      message: "This is a test notification to verify the system is working properly.",
      type: 'info',
      priority: 'medium',
      category: 'general',
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    
    setNotifications(prev => [testNotif, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    toast("Test notification added!", {
      duration: 3000,
      icon: '🧪',
    });
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      notifications, 
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      testNotification
    }}>
      {children}
    </SocketContext.Provider>
  );
}; 