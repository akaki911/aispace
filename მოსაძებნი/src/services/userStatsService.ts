
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface FirestoreBooking {
  id: string;
  totalPrice?: number;
  createdAt?: Date | { toDate: () => Date } | Timestamp;
  'გადასახდილია'?: boolean;
}

interface FirestoreReview {
  id: string;
  createdAt?: Date | { toDate: () => Date } | Timestamp;
  [key: string]: unknown;
}

export interface UserStats {
  totalBookings: number;
  totalAmountPaid: number;
  lastBookingDate: Date | null;
  bookings: any[];
  reviews: any[];
}

export const getUserStats = async (userId: string): Promise<UserStats> => {
  console.log('🔍 Fetching user statistics for:', userId);
  
  try {
    // მომხმარებლის ჯავშნების მოძიება
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', userId)
    );
    const bookingsSnap = await getDocs(bookingsQuery);
    const bookings: FirestoreBooking[] = bookingsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // რეცენზიების მოძიება
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('userId', '==', userId)
    );
    const reviewsSnap = await getDocs(reviewsQuery);
    const reviews: FirestoreReview[] = reviewsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // სტატისტიკის გამოთვლა
    const totalBookings = bookings.length;
    const totalAmountPaid = bookings
      .filter(booking => booking['გადასახდილია'])
      .reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);

    const resolveDate = (value?: FirestoreBooking['createdAt']): Date | null => {
      if (!value) return null;
      if (value instanceof Timestamp) {
        return value.toDate();
      }
      if (value instanceof Date) {
        return value;
      }
      if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        return value.toDate();
      }
      return new Date(value as unknown as string);
    };

    const lastBookingDate = bookings.length > 0
      ? new Date(Math.max(...bookings
          .map(b => resolveDate(b.createdAt)?.getTime() ?? 0)
          .filter(timestamp => timestamp > 0)))
      : null;

    console.log('📊 User stats calculated:', {
      totalBookings,
      totalAmountPaid,
      lastBookingDate,
      reviewsCount: reviews.length
    });

    return {
      totalBookings,
      totalAmountPaid,
      lastBookingDate,
      bookings: bookings.sort((a, b) => {
        const aDate = resolveDate(a.createdAt)?.getTime() ?? 0;
        const bDate = resolveDate(b.createdAt)?.getTime() ?? 0;
        return bDate - aDate;
      }),
      reviews
    };
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    throw normalizedError;
  }
};
