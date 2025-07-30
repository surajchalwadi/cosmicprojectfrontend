import React from 'react';
import { useSocket } from '@/contexts/SocketContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';

const TestToast = () => {
  const { 
    socket, 
    notifications, 
    unreadCount, 
    isConnected,
    markAsRead, 
    markAllAsRead, 
    clearNotifications,
    loadNotificationsFromAPI 
  } = useSocket();

  const testNotifications = () => {
    // Test different types of notifications
    toast.success('This is a success notification!', {
      duration: 5000,
      icon: '✅',
    });

    toast.error('This is an error notification!', {
      duration: 6000,
      icon: '❌',
    });

    toast('This is a warning notification!', {
      duration: 5000,
      icon: '⚠️',
      style: {
        background: '#fbbf24',
        color: '#1f2937',
      },
    });

    toast('This is an info notification!', {
      duration: 4000,
      icon: 'ℹ️',
    });
  };

  const testSocketConnection = () => {
    if (socket) {
      console.log('Socket connection status:', socket.connected);
      console.log('Socket ID:', socket.id);
      toast(`Socket connected: ${socket.connected ? 'Yes' : 'No'}`);
    } else {
      toast.error('Socket not initialized');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification System Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant={isConnected ? "default" : "destructive"}>
              Socket: {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Badge variant="outline">
              Unread: {unreadCount}
            </Badge>
            <Badge variant="outline">
              Total: {notifications.length}
            </Badge>
          </div>

          <div className="flex gap-2">
            <Button onClick={testNotifications}>
              Test Toast Notifications
            </Button>
            <Button onClick={testSocketConnection}>
              Test Socket Connection
            </Button>
            <Button onClick={loadNotificationsFromAPI}>
              Load from API
            </Button>
            <Button onClick={markAllAsRead}>
              Mark All Read
            </Button>
            <Button onClick={clearNotifications} variant="destructive">
              Clear All
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Recent Notifications:</h3>
            {notifications.length === 0 ? (
              <p className="text-muted-foreground">No notifications</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border rounded-lg ${
                      !notification.isRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {notification.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {notification.priority}
                          </Badge>
                          {!notification.isRead && (
                            <Badge variant="default" className="text-xs">
                              Unread
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(notification.id)}
                      >
                        Mark Read
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestToast; 