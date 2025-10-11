
import React, { useEffect, useState } from 'react';
import { Bell, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/useTheme';

interface NotificationData {
  id: string;
  type: 'message' | 'support' | 'urgent';
  title: string;
  message: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

const MessagingNotificationSystem: React.FC = () => {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // Mock notifications - replace with real-time Firebase listener
    const mockNotifications: NotificationData[] = [
      {
        id: '1',
        type: 'message',
        title: 'ახალი შეტყობინება',
        message: 'ნინო გრიგალაშვილი: "რომელი საათია ჩეკ-ინი?"',
        conversationId: 'conv-1',
        senderId: 'user-2',
        senderName: 'ნინო გრიგალაშვილი',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        isRead: false,
        priority: 'normal'
      },
      {
        id: '2',
        type: 'urgent',
        title: 'გადაუდებელი შეტყობინება',
        message: 'მხარდაჭერა: "კლიენტი ანგარიშობს ხანძრის საფრთხეს"',
        conversationId: 'conv-2',
        senderId: 'admin-1',
        senderName: 'მხარდაჭერა',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        isRead: false,
        priority: 'urgent'
      }
    ];

    setNotifications(mockNotifications);
  }, []);

  // Play notification sound
  const playNotificationSound = () => {
    if (soundEnabled) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dyvmo=');
      audio.play().catch(() => {
        // Handle error if audio can't be played
      });
    }
  };

  // Send email notification for unread messages
  const sendEmailNotification = async (notification: NotificationData) => {
    // This would call your backend API to send email
    console.log('Sending email notification:', notification);
  };

  useEffect(() => {
    // Check for new notifications and send alerts
    const unreadNotifications = notifications.filter(n => !n.isRead);
    
    if (unreadNotifications.length > 0) {
      // Play sound for urgent notifications
      const urgentNotifications = unreadNotifications.filter(n => n.priority === 'urgent');
      if (urgentNotifications.length > 0) {
        playNotificationSound();
      }

      // Send browser notification if permission granted
      if (Notification.permission === 'granted') {
        unreadNotifications.forEach(notification => {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.svg',
            tag: notification.id
          });
        });
      }

      // Send email notifications after 15 minutes for unread messages
      unreadNotifications.forEach(notification => {
        const timeSinceReceived = Date.now() - notification.timestamp.getTime();
        if (timeSinceReceived > 15 * 60 * 1000) { // 15 minutes
          sendEmailNotification(notification);
        }
      });
    }
  }, [notifications, soundEnabled]);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  };

  const clearAllNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getNotificationIcon = (type: string, priority: string) => {
    if (priority === 'urgent') return '🚨';
    switch (type) {
      case 'message': return '💬';
      case 'support': return '🎧';
      default: return '📢';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high': return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20';
      default: return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className={`relative p-2 rounded-lg transition-colors ${
          isDarkMode 
            ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className={`absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg shadow-lg border z-50 ${
          isDarkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              შეტყობინებები ({unreadCount})
            </h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className={`text-sm px-2 py-1 rounded transition-colors ${
                    isDarkMode 
                      ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  ყველას წაკითხვა
                </button>
              )}
              <button
                onClick={() => setShowNotifications(false)}
                className={`p-1 rounded transition-colors ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className={`mx-auto h-8 w-8 mb-3 ${
                  isDarkMode ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  ახალი შეტყობინებები არ არის
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markAsRead(notification.id)}
                  className={`p-4 border-b border-l-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    getPriorityColor(notification.priority)
                  } ${
                    isDarkMode ? 'border-b-gray-700' : 'border-b-gray-200'
                  } ${
                    !notification.isRead ? 'font-medium' : 'opacity-75'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-lg flex-shrink-0">
                      {getNotificationIcon(notification.type, notification.priority)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium truncate ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2"></div>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {notification.message}
                      </p>
                      <p className={`text-xs mt-2 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {notification.timestamp.toLocaleString('ka-GE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Settings Footer */}
          <div className={`p-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="rounded"
              />
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                ხმოვანი შეტყობინებები
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagingNotificationSystem;
