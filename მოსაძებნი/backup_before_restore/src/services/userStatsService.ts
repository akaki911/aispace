
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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
    const bookings = bookingsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // რეცენზიების მოძიება
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('userId', '==', userId)
    );
    const reviewsSnap = await getDocs(reviewsQuery);
    const reviews = reviewsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // სტატისტიკის გამოთვლა
    const totalBookings = bookings.length;
    const totalAmountPaid = bookings
      .filter(booking => booking.გადასახდილია)
      .reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
    
    const lastBookingDate = bookings.length > 0
      ? new Date(Math.max(...bookings.map(b => new Date(b.createdAt).getTime())))
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
      bookings: bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      reviews
    };
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    throw error;
  }
};
