
const express = require('express');
const router = express.Router();

const log = (...args) => console.log('🔍[user_activity]', ...args);

// Store user activities (in production use proper database)
const activityStore = new Map();

// User activity logging endpoint
router.post('/', (req, res) => {
  try {
    const { userId, action, timestamp, sessionId, userAgent, metadata } = req.body;
    
    if (!userId || !action || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const activity = {
      userId,
      action,
      timestamp,
      sessionId,
      userAgent,
      metadata,
      ip: req.ip || req.connection.remoteAddress,
      recordedAt: Date.now()
    };

    // Store activity (in production, use Firebase/database)
    if (!activityStore.has(userId)) {
      activityStore.set(userId, []);
    }
    
    const userActivities = activityStore.get(userId);
    userActivities.push(activity);
    
    // Keep only last 1000 activities per user
    if (userActivities.length > 1000) {
      userActivities.splice(0, userActivities.length - 1000);
    }

    // Log significant activities
    if (['authentication_attempt', 'webauthn_flow', 'booking_activity'].includes(action)) {
      log(`User ${userId} performed: ${action}`, metadata);
    }

    res.json({ success: true, activityId: `${userId}_${timestamp}` });

  } catch (error) {
    console.error('User activity logging error:', error);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// Get user activities (admin only)
router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100, since } = req.query;

    // In production, add proper admin authentication here
    if (!req.session?.isSuperAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const userActivities = activityStore.get(userId) || [];
    let filteredActivities = userActivities;

    if (since) {
      const sinceTimestamp = parseInt(since);
      filteredActivities = userActivities.filter(a => a.timestamp > sinceTimestamp);
    }

    // Sort by timestamp (newest first) and limit
    const activities = filteredActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit));

    res.json({
      userId,
      activities,
      totalCount: userActivities.length,
      filteredCount: activities.length
    });

  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ error: 'Failed to retrieve activities' });
  }
});

// Get activity statistics (admin only)
router.get('/stats/summary', (req, res) => {
  try {
    if (!req.session?.isSuperAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = {
      totalUsers: activityStore.size,
      totalActivities: 0,
      actionBreakdown: {},
      recentSessions: []
    };

    for (const [userId, activities] of activityStore) {
      stats.totalActivities += activities.length;
      
      activities.forEach(activity => {
        stats.actionBreakdown[activity.action] = 
          (stats.actionBreakdown[activity.action] || 0) + 1;
      });

      // Get recent session info
      const recentActivity = activities[activities.length - 1];
      if (recentActivity && recentActivity.timestamp > Date.now() - (24 * 60 * 60 * 1000)) {
        stats.recentSessions.push({
          userId,
          sessionId: recentActivity.sessionId,
          lastActivity: recentActivity.timestamp,
          actionsCount: activities.filter(a => 
            a.sessionId === recentActivity.sessionId
          ).length
        });
      }
    }

    res.json(stats);

  } catch (error) {
    console.error('Get activity stats error:', error);
    res.status(500).json({ error: 'Failed to get activity statistics' });
  }
});

module.exports = router;
