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
  testSocketConnection: () => void;
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

  // Debug socket state changes
  useEffect(() => {
    console.log("SocketContext - Socket state changed:", !!socket, socket?.id, socket?.connected);
  }, [socket]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    console.log("SocketContext - Token available:", !!token);
    console.log("SocketContext - SOCKET_URL:", SOCKET_URL);
    
    if (!token) {
      console.log("SocketContext - No token found, skipping socket connection");
      return;
    }

    // Get current user from session storage
    const currentUserStr = sessionStorage.getItem("currentUser");
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    console.log("SocketContext - Current user:", currentUser);

    const s = io(SOCKET_URL, {
      auth: { 
        token,
        userId: currentUser?.id,
        userRole: currentUser?.role
      },
      transports: ["websocket"],
      withCredentials: true,
    });

    // Socket connection events
    s.on("connect", () => {
      console.log("SocketContext - Connected to server");
      console.log("SocketContext - Socket ID:", s.id);
      console.log("SocketContext - Socket auth:", s.auth);
      toast.success("Connected to real-time updates");
      
      // Set up all event listeners AFTER connection is established
      s.on("authenticated", (data: any) => {
        console.log("SocketContext - Socket authenticated:", data);
      });

      s.on("unauthorized", (data: any) => {
        console.log("SocketContext - Socket unauthorized:", data);
      });

      // Test event listener to verify socket communication
      s.on("test:response", (data: any) => {
        console.log("SocketContext - Test response received:", data);
      });

      // Listen for all events to debug
      s.onAny((eventName: string, ...args: any[]) => {
        console.log("SocketContext - Received event:", eventName, args);
      });

      // Test broadcast event listener
      s.on("test:broadcast", (data: any) => {
        console.log("SocketContext - Test broadcast received:", data);
        toast.info("Test broadcast received from manager");
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
      console.log("SocketContext - Setting up task:assigned listener");
      s.on("task:assigned", (data: any) => {
        console.log("SocketContext - Task assigned event received:", data);
        console.log("SocketContext - Current user should be technician:", data.technician?._id);
        console.log("SocketContext - Event data structure:", JSON.stringify(data, null, 2));
        console.log("SocketContext - Current user ID from session:", currentUser?.id);
        console.log("SocketContext - Current user role:", currentUser?.role);
        
        toast.success(`Task "${data.task.title}" assigned to you`, {
          duration: 5000,
          icon: '📋',
        });
        
        // Add notification to the notification bell
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
        
        console.log("Adding notification to bell:", notification);
        setNotifications(prev => {
          console.log("Previous notifications:", prev);
          const newNotifications = [notification, ...prev];
          console.log("New notifications array:", newNotifications);
          return newNotifications;
        });
        setUnreadCount(prev => {
          console.log("Previous unread count:", prev);
          const newCount = prev + 1;
          console.log("New unread count:", newCount);
          return newCount;
        });
      });

      // Also listen for the specific technician event
      s.on("task:assigned:technician", (data: any) => {
        console.log("SocketContext - Task assigned:technician event received:", data);
        console.log("SocketContext - Target technician ID:", data.technicianId);
        console.log("SocketContext - Current user ID:", currentUser?.id);
        
        // Check if this event is for the current user
        if (data.technicianId === currentUser?.id) {
          console.log("SocketContext - This task assignment is for current user!");
          
          toast.success(`Task "${data.task.title}" assigned to you`, {
            duration: 5000,
            icon: '📋',
          });
          
          // Add notification to the notification bell
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
              technicianId: data.technicianId
            },
            createdAt: new Date().toISOString(),
            isRead: false
          };
          
          console.log("Adding notification to bell:", notification);
          setNotifications(prev => {
            console.log("Previous notifications:", prev);
            const newNotifications = [notification, ...prev];
            console.log("New notifications array:", newNotifications);
            return newNotifications;
          });
          setUnreadCount(prev => {
            console.log("Previous unread count:", prev);
            const newCount = prev + 1;
            console.log("New unread count:", newCount);
            return newCount;
          });
        } else {
          console.log("SocketContext - This task assignment is NOT for current user");
        }
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

      s.on("project:created", (data: any) => {
        toast.success(`New project "${data.project.siteName}" created`, {
          duration: 4000,
          icon: '🏗️',
        });
      });

      s.on("project:updated", (data: any) => {
        toast.info(`Project "${data.project.siteName}" updated`, {
          duration: 4000,
          icon: '📝',
        });
      });

      s.on("user:login", (data: any) => {
        toast.info(`${data.user.name} logged in`, {
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
      
      // Set socket only after it's connected and all listeners are set up
      setSocket(s);
    });

    s.on("disconnect", () => {
      console.log("Disconnected from server");
      toast.error("Lost connection to real-time updates");
    });

    return () => {
      console.log("SocketContext - Cleaning up socket connection");
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

  // Test socket connection
  const testSocketConnection = () => {
    if (socket) {
      console.log("SocketContext - Testing socket connection...");
      socket.emit("test:ping", { message: "Hello from client", timestamp: Date.now() });
    } else {
      console.log("SocketContext - No socket available for testing");
    }
  };

  return (
    <SocketContext.Provider value={{ 
      socket, 
      notifications, 
      unreadCount,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      testSocketConnection
    }}>
      {children}
    </SocketContext.Provider>
  );
}; 