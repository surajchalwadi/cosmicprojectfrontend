import React from 'react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/contexts/SocketContext';

const NotificationTest = () => {
  const { 
    socket, 
    notifications, 
    unreadCount, 
    testNotification,
    clearNotifications 
  } = useSocket();

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">🔧 Notification Debug Panel</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Socket Status:</p>
            <p className="text-sm text-gray-600">
              {socket ? '✅ Connected' : '❌ Disconnected'}
            </p>
          </div>
          
          <div>
            <p className="text-sm font-medium">Notifications:</p>
            <p className="text-sm text-gray-600">
              {notifications.length} total, {unreadCount} unread
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={testNotification}
            className="bg-blue-500 hover:bg-blue-600"
          >
            🧪 Add Test Notification
          </Button>
          
          <Button 
            onClick={clearNotifications}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            🗑️ Clear All
          </Button>
        </div>

        {notifications.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Recent Notifications:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {notifications.slice(0, 5).map((notification) => (
                <div 
                  key={notification.id}
                  className="p-2 bg-white border rounded text-sm"
                >
                  <div className="font-medium">{notification.title}</div>
                  <div className="text-gray-600">{notification.message}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationTest; 