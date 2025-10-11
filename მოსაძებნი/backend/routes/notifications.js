const express = require('express');
const router = express.Router();

// Mock notifications storage
let notifications = [];

// Notification types
const NOTIFICATION_TYPES = {
  SYSTEM: 'system',
  BOOKING: 'booking',
  REMINDER: 'reminder',
  MESSAGE: 'message',
  PAYMENT: 'payment'
};

// Get user notifications
router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const userNotifications = notifications
      .filter(notification => notification.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    const unreadCount = notifications.filter(
      notification => notification.userId === userId && !notification.isRead
    ).length;

    res.json({
      success: true,
      notifications: userNotifications,
      unreadCount,
      total: notifications.filter(n => n.userId === userId).length
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'შეცდომა შეტყობინებების ჩატვირთვისას'
    });
  }
});

// Create a new notification
router.post('/', (req, res) => {
  try {
    const {
      userId,
      type,
      title,
      message,
      actionUrl,
      metadata = {}
    } = req.body;

    if (!userId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'სავალდებულო ველები არ არის შევსებული'
      });
    }

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title,
      message,
      actionUrl: actionUrl || null,
      metadata,
      timestamp: new Date().toISOString(),
      isRead: false,
      isArchived: false
    };

    notifications.push(notification);

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'შეცდომა შეტყობინების შექმნისას'
    });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', (req, res) => {
  try {
    const { notificationId } = req.params;

    const notificationIndex = notifications.findIndex(
      notification => notification.id === notificationId
    );

    if (notificationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'შეტყობინება ვერ მოიძებნა'
      });
    }

    notifications[notificationIndex].isRead = true;

    res.json({
      success: true,
      notification: notifications[notificationIndex]
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'შეცდომა შეტყობინების მონიშვნისას'
    });
  }
});

// Mark all notifications as read for user
router.patch('/user/:userId/read-all', (req, res) => {
  try {
    const { userId } = req.params;

    notifications = notifications.map(notification => {
      if (notification.userId === userId && !notification.isRead) {
        return { ...notification, isRead: true };
      }
      return notification;
    });

    res.json({
      success: true,
      message: 'ყველა შეტყობინება მონიშნულია როგორც წაკითხული'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'შეცდომა შეტყობინებების მონიშვნისას'
    });
  }
});

// Create check-in reminder notifications (called by scheduled job)
router.post('/check-in-reminders', (req, res) => {
  try {
    // This would typically query the database for bookings with check-in today
    // For demo purposes, we'll create mock reminders

    const today = new Date().toDateString();
    console.log(`Creating check-in reminders for ${today}`);

    // Mock booking data - in real implementation, query from database
    const todayBookings = [
      {
        id: '1234',
        userId: 'provider123',
        guestName: 'გიორგი მალხაზოვი',
        listingTitle: 'კოტეჯი "ბახმაროს ბუნება"',
        checkInTime: '14:00'
      }
    ];

    const createdNotifications = [];

    todayBookings.forEach(booking => {
      const notification = {
        id: `checkin_${booking.id}_${Date.now()}`,
        userId: booking.userId,
        type: NOTIFICATION_TYPES.REMINDER,
        title: 'დღეს ჩასვლის დღეა!',
        message: `ბრონირება #${booking.id} - ${booking.listingTitle} - მისალმება: ${booking.checkInTime}`,
        actionUrl: `/admin/bookings/${booking.id}`,
        metadata: {
          bookingId: booking.id,
          guestName: booking.guestName,
          checkInTime: booking.checkInTime
        },
        timestamp: new Date().toISOString(),
        isRead: false,
        isArchived: false
      };

      notifications.push(notification);
      createdNotifications.push(notification);
    });

    res.json({
      success: true,
      message: `${createdNotifications.length} შეტყობინება შეიქმნა`,
      notifications: createdNotifications
    });
  } catch (error) {
    console.error('Error creating check-in reminders:', error);
    res.status(500).json({
      success: false,
      message: 'შეცდომა შეტყობინებების შექმნისას'
    });
  }
});

// Create booking notification
router.post('/booking-created', (req, res) => {
  try {
    const {
      providerId,
      bookingId,
      guestName,
      listingTitle,
      checkInDate,
      nights,
      totalAmount
    } = req.body;

    const notification = {
      id: `booking_${bookingId}_${Date.now()}`,
      userId: providerId,
      type: NOTIFICATION_TYPES.BOOKING,
      title: 'ახალი ბრონირება!',
      message: `${guestName}-მ დაჯავშნა "${listingTitle}" ${nights} ღამით. ჯამური თანხა: ${totalAmount}₾`,
      actionUrl: `/admin/bookings/${bookingId}`,
      metadata: {
        bookingId,
        guestName,
        listingTitle,
        checkInDate,
        nights,
        totalAmount
      },
      timestamp: new Date().toISOString(),
      isRead: false,
      isArchived: false
    };

    notifications.push(notification);

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error creating booking notification:', error);
    res.status(500).json({
      success: false,
      message: 'შეცდომა შეტყობინების შექმნისას'
    });
  }
});

module.exports = router;