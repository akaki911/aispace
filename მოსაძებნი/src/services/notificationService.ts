
import { auth } from '../firebaseConfig';

const API_BASE = '/api/notifications';

interface Notification {
  id: string;
  userId: string;
  type: 'system' | 'booking' | 'reminder' | 'message' | 'payment';
  title: string;
  message: string;
  actionUrl?: string;
  metadata: Record<string, any>;
  timestamp: string;
  isRead: boolean;
  isArchived: boolean;
}

export const notificationService = {
  // Get user notifications
  async getNotifications(limit: number = 20, offset: number = 0): Promise<{
    notifications: Notification[];
    unreadCount: number;
    total: number;
  }> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const response = await fetch(`${API_BASE}/${user.uid}?limit=${limit}&offset=${offset}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'შეცდომა შეტყობინებების ჩატვირთვისას');
      }
      
      return {
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        total: data.total
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  },

  // Create notification
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    actionUrl?: string,
    metadata: Record<string, any> = {}
  ): Promise<Notification> {
    try {
      const response = await fetch(`${API_BASE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          type,
          title,
          message,
          actionUrl,
          metadata
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'შეცდომა შეტყობინების შექმნისას');
      }
      
      return data.notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  },

  // Mark notification as read
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'შეცდომა შეტყობინების მონიშვნისას');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  },

  // Mark all notifications as read
  async markAllAsRead(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      const response = await fetch(`${API_BASE}/user/${user.uid}/read-all`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'შეცდომა შეტყობინებების მონიშვნისას');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  },

  // Create booking notification
  async createBookingNotification(
    providerId: string,
    bookingId: string,
    guestName: string,
    listingTitle: string,
    checkInDate: string,
    nights: number,
    totalAmount: number
  ): Promise<Notification> {
    try {
      const response = await fetch(`${API_BASE}/booking-created`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId,
          bookingId,
          guestName,
          listingTitle,
          checkInDate,
          nights,
          totalAmount
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'შეცდომა შეტყობინების შექმნისას');
      }
      
      return data.notification;
    } catch (error) {
      console.error('Error creating booking notification:', error);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  },

  // Create check-in reminders (typically called by scheduled job)
  async createCheckInReminders(): Promise<Notification[]> {
    try {
      const response = await fetch(`${API_BASE}/check-in-reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'შეცდომა შეტყობინებების შექმნისას');
      }
      
      return data.notifications;
    } catch (error) {
      console.error('Error creating check-in reminders:', error);
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  }
};
