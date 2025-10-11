import { collection, doc, updateDoc, deleteDoc, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export class BookingExpirationService {
  private static instance: BookingExpirationService;
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private initialized: boolean = false; // Track initialization state

  private constructor() {
    // Don't start cleanup interval immediately
    // Wait for explicit initialization after authentication
  }

  static getInstance(): BookingExpirationService {
    if (!BookingExpirationService.instance) {
      BookingExpirationService.instance = new BookingExpirationService();
    }
    return BookingExpirationService.instance;
  }

  // Initialize the service, including starting cleanup intervals
  async initialize() {
    if (this.initialized) return;

    console.log('🔧 Initializing BookingExpirationService...');
    this.startCleanupInterval();
    this.initialized = true;
    console.log('✅ BookingExpirationService initialized');
  }

  // Placeholder for the cleanup interval logic (if needed)
  private startCleanupInterval() {
    // This method would typically handle clearing expired timers or other periodic tasks.
    // For now, it's a placeholder as the primary focus is on initialization.
    console.log('🚀 Cleanup interval started (placeholder)');
  }

  // Set up expiration timer for a booking (15 წუთი)
  setupExpirationTimer(bookingId: string, createdAt: Date, onExpire?: () => void) {
    // Clear existing timer if any
    this.clearTimer(bookingId);

    const expiryTime = new Date(createdAt.getTime() + 15 * 60 * 1000); // 15 წუთი
    const now = new Date();
    const timeUntilExpiry = expiryTime.getTime() - now.getTime();

    console.log(`⏰ Setting up 15-minute expiration timer for booking ${bookingId}`);
    console.log(`⏰ Expires at: ${expiryTime.toLocaleString()}`);
    console.log(`⏰ Time until expiry: ${Math.round(timeUntilExpiry / 1000)} seconds`);

    if (timeUntilExpiry <= 0) {
      // Already expired
      console.log(`⏰ Booking ${bookingId} already expired, expiring immediately`);
      this.expireBooking(bookingId);
      return;
    }

    const timer = setTimeout(() => {
      console.log(`⏰ Timer expired for booking ${bookingId}`);
      this.expireBooking(bookingId);
      if (onExpire) {
        onExpire();
      }
    }, timeUntilExpiry);

    this.activeTimers.set(bookingId, timer);
    console.log(`⏰ Expiration timer set for booking ${bookingId} (${Math.round(timeUntilExpiry / 1000)} seconds)`);
  }

  // Get remaining time for a booking
  getRemainingTime(bookingId: string, createdAt: Date): number {
    const expiryTime = new Date(createdAt.getTime() + 15 * 60 * 1000);
    const now = new Date();
    const timeLeft = expiryTime.getTime() - now.getTime();
    return Math.max(0, timeLeft);
  }

  // Format remaining time as MM:SS
  formatRemainingTime(bookingId: string, createdAt: Date): string {
    const timeLeft = this.getRemainingTime(bookingId, createdAt);
    if (timeLeft <= 0) return '00:00';

    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Clear timer for a booking
  clearTimer(bookingId: string) {
    const timer = this.activeTimers.get(bookingId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(bookingId);
      console.log(`⏰ Timer cleared for booking ${bookingId}`);
    }
  }

  // Expire a booking
  private async expireBooking(bookingId: string) {
    try {
      console.log(`⏰ Expiring booking ${bookingId}`);

      // Update booking status to expired
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        status: 'გაუქმებული',
        გადასახდილია: false,
        isPaid: false,
        expiredAt: new Date(),
        notes: 'ჯავშანი გაუქმდა - 15 წუთში არ დადასტურდა',
        cancellation: {
          reason: '',
          canceledBy: 'system',
          canceledAt: new Date()
        }
      });

      // Also update vehicle and hotel bookings
      try {
        const vehicleBookingRef = doc(db, 'vehicleBookings', bookingId);
        await updateDoc(vehicleBookingRef, {
          status: 'გაუქმებული',
          გადასახდილია: false,
          isPaid: false,
          expiredAt: new Date(),
          notes: 'ჯავშანი გაუქმდა - 15 წუთში არ დადასტურდა',
          cancellation: {
            reason: '',
            canceledBy: 'system',
            canceledAt: new Date()
          }
        });
      } catch (error) {
        // Booking might not exist in vehicle collection
      }

      try {
        const hotelBookingRef = doc(db, 'hotelBookings', bookingId);
        await updateDoc(hotelBookingRef, {
          status: 'გაუქმებული',
          გადასახდილია: false,
          isPaid: false,
          expiredAt: new Date(),
          notes: 'ჯავშანი გაუქმდა - 15 წუთში არ დადასტურდა',
          cancellation: {
            reason: '',
            canceledBy: 'system',
            canceledAt: new Date()
          }
        });
      } catch (error) {
        // Booking might not exist in hotel collection
      }

      // Remove temporary blocks
      await this.removeTemporaryBlocks(bookingId);

      this.clearTimer(bookingId);

      console.log(`✅ Booking ${bookingId} expired successfully and marked as გაუქმებული`);
    } catch (error) {
      console.error(`❌ Error expiring booking ${bookingId}:`, error);
    }
  }

  // Remove temporary blocks for expired booking
  private async removeTemporaryBlocks(bookingId: string) {
    try {
      const blocksRef = collection(db, 'temporaryBlocks');
      const q = query(blocksRef, where('bookingId', '==', bookingId));
      const snapshot = await getDocs(q);

      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log(`✅ Temporary blocks removed for booking ${bookingId}`);
    } catch (error) {
      console.error(`❌ Error removing temporary blocks for booking ${bookingId}:`, error);
    }
  }

  // Check and set up timers for existing unpaid bookings
  async initializeExistingBookings() {
    try {
      // Check if user is authenticated before proceeding
      const { auth } = await import('../firebase');
      if (!auth.currentUser) {
        console.log('⚠️ No authenticated user - skipping booking initialization');
        return;
      }

      console.log('🔧 Initializing existing bookings for authenticated user');
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('status', '==', 'pending'),
        where('გადასახდილია', '==', false)
      );

      const snapshot = await getDocs(q);

      snapshot.docs.forEach(doc => {
        const booking = doc.data();
        const createdAt = booking.createdAt?.toDate() || new Date();

        // Only set timer if booking is not older than 15 minutes
        const now = new Date();
        const timeSinceCreation = now.getTime() - createdAt.getTime();

        if (timeSinceCreation < 15 * 60 * 1000) {
          this.setupExpirationTimer(doc.id, createdAt);
        } else {
          // Expire immediately if older than 15 minutes
          this.expireBooking(doc.id);
        }
      });

      console.log(`✅ Initialized timers for ${snapshot.size} existing bookings`);
    } catch (error) {
      console.error('❌ Error initializing existing bookings:', error);
    }
  }

  // Call this when a booking is paid to clear the timer
  confirmBooking(bookingId: string) {
    this.clearTimer(bookingId);
    console.log(`✅ Booking ${bookingId} confirmed, timer cleared`);
  }

  // Restart timer with new start time (for admin status changes)
  restartExpirationTimer(bookingId: string, newStartTime: Date, onExpire?: () => void) {
    console.log(`🔄 Restarting expiration timer for booking ${bookingId} from ${newStartTime}`);
    this.setupExpirationTimer(bookingId, newStartTime, onExpire);
  }
}

export const bookingExpirationService = BookingExpirationService.getInstance();