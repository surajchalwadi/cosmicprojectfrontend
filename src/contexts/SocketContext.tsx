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

class NotificationClient {
  private socket: Socket | null = null;
  private isConnected = false;
  private setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  private setUnreadCount: React.Dispatch<React.SetStateAction<number>>;

  constructor(
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>,
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>
  ) {
    this.setNotifications = setNotifications;
    this.setUnreadCount = setUnreadCount;
  }

  connect(token: string) {
    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to notifications');
      this.isConnected = true;
      toast.success("Connected to real-time updates");
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from notifications');
      this.isConnected = false;
      toast.error("Lost connection to real-time updates");
    });

    this.socket.on('notification:new', (notification: Notification) => {
      console.log('🔔 New notification:', notification);
      this.handleNewNotification(notification);
    });

    this.socket.on('task:assigned', (data: any) => {
      console.log('📋 Task assigned:', data);
      this.handleTaskAssigned(data);
    });

    this.socket.on('task:completed', (data: any) => {
      toast.success(`Task "${data.task.title}" completed successfully`, {
        duration: 4000,
        icon: '✅',
      });
    });

    this.socket.on('task:overdue', (data: any) => {
      toast.error(`Task "${data.task.title}" is overdue!`, {
        duration: 8000,
        icon: '⏰',
      });
    });

    this.socket.on('project:created', (data: any) => {
      toast.success(`New project "${data.project.siteName}" created`, {
        duration: 4000,
        icon: '🏗️',
      });
    });

    this.socket.on('project:updated', (data: any) => {
      toast(`Project "${data.project.siteName}" updated`, {
        duration: 4000,
        icon: '📝',
      });
    });

    this.socket.on('user:login', (data: any) => {
      toast(`${data.user.name} logged in`, {
        duration: 3000,
        icon: '👤',
      });
    });

    this.socket.on('system:maintenance', (data: any) => {
      toast(data.message, {
        duration: 8000,
        icon: '🔧',
        style: {
          background: '#3b82f6',
          color: 'white',
        },
      });
    });

    this.socket.on('system:alert', (data: any) => {
      toast.error(data.message, {
        duration: 10000,
        icon: '🚨',
      });
    });
  }

  private handleNewNotification(notification: Notification) {
    const newNotification = { ...notification, isRead: false };
    this.setNotifications(prev => [newNotification, ...prev]);
    this.setUnreadCount(prev => prev + 1);

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
  }

  private handleTaskAssigned(data: any) {
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
    
    this.setNotifications(prev => [notification, ...prev]);
    this.setUnreadCount(prev => prev + 1);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getSocket() {
    return this.socket;
  }

  isSocketConnected() {
    return this.isConnected;
  }
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationClient, setNotificationClient] = useState<NotificationClient | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      return;
    }

    const client = new NotificationClient(setNotifications, setUnreadCount);
    client.connect(token);
    setNotificationClient(client);
    setSocket(client.getSocket());

    return () => {
      client.disconnect();
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