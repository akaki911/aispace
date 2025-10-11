
import { auth } from '../firebase';
import { logger } from './loggingService';

interface UserActivity {
  userId: string;
  action: string;
  timestamp: number;
  sessionId: string;
  userAgent: string;
  ip?: string;
  metadata?: Record<string, any>;
}

class UserActivityMonitor {
  private activities: UserActivity[] = [];
  private sessionId: string;
  private isEnabled: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isEnabled = import.meta.env.PROD || 
                     localStorage.getItem('enable_activity_monitoring') === 'true';
    this.initializeMonitoring();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMonitoring(): void {
    if (!this.isEnabled) return;

    // Monitor authentication events
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.logActivity('auth_state_changed', {
          uid: user.uid,
          email: user.email,
          provider: user.providerData[0]?.providerId || 'unknown'
        });
      }
    });

    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.logActivity('page_visibility_change', {
        hidden: document.hidden,
        visibilityState: document.visibilityState
      });
    });

    // Monitor navigation
    window.addEventListener('beforeunload', () => {
      this.logActivity('page_unload', {
        url: window.location.href,
        sessionDuration: Date.now() - parseInt(this.sessionId.split('_')[1])
      });
    });

    console.log('🔍 User Activity Monitor initialized');
  }

  public logActivity(action: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;

    const currentUser = auth.currentUser;
    const activity: UserActivity = {
      userId: currentUser?.uid || 'anonymous',
      action,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      metadata
    };

    this.activities.push(activity);
    this.persistActivity(activity);

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log('📊 User Activity:', action, metadata);
    }
  }

  private async persistActivity(activity: UserActivity): Promise<void> {
    try {
      // Send to backend for persistent storage
      await fetch('/api/user-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activity),
        credentials: 'include'
      });
    } catch (error) {
      console.warn('Failed to persist user activity:', error);
      // Store locally as fallback
      this.storeActivityLocally(activity);
    }
  }

  private storeActivityLocally(activity: UserActivity): void {
    try {
      const stored = JSON.parse(localStorage.getItem('user_activities') || '[]');
      stored.push(activity);
      
      // Keep only last 100 activities locally
      if (stored.length > 100) {
        stored.splice(0, stored.length - 100);
      }
      
      localStorage.setItem('user_activities', JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to store activity locally:', error);
    }
  }

  public getActivities(): UserActivity[] {
    return [...this.activities];
  }

  public getSessionSummary(): Record<string, any> {
    const sessionStart = parseInt(this.sessionId.split('_')[1]);
    const sessionDuration = Date.now() - sessionStart;
    
    const actionCounts = this.activities.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      sessionId: this.sessionId,
      duration: sessionDuration,
      activitiesCount: this.activities.length,
      actionBreakdown: actionCounts,
      userId: auth.currentUser?.uid || 'anonymous'
    };
  }

  // Authentication specific monitoring
  public logAuthenticationAttempt(method: 'passkey' | 'fallback', success: boolean, error?: string): void {
    this.logActivity('authentication_attempt', {
      method,
      success,
      error: success ? null : error,
      timestamp: Date.now()
    });
  }

  public logWebAuthnFlow(step: string, success: boolean, metadata?: Record<string, any>): void {
    this.logActivity('webauthn_flow', {
      step,
      success,
      ...metadata
    });
  }

  public logBookingActivity(action: 'create' | 'cancel' | 'modify', bookingId: string): void {
    this.logActivity('booking_activity', {
      action,
      bookingId,
      timestamp: Date.now()
    });
  }
}

export const userActivityMonitor = new UserActivityMonitor();
