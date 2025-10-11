
import { collection, doc, getDocs, addDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { Review, ReviewFormData, ProviderReply, UserBooking } from '../types/review';

// Create a new review
export const createReview = async (
  userId: string,
  bookingId: string,
  resourceId: string,
  resourceType: 'cottage' | 'hotel' | 'vehicle',
  reviewData: ReviewFormData
): Promise<Review> => {
  try {
    // Upload photos if any
    const photoUrls: string[] = [];
    if (reviewData.photos.length > 0) {
      for (const photo of reviewData.photos.slice(0, 2)) { // Max 2 photos
        const photoRef = ref(storage, `reviews/${resourceId}/${Date.now()}-${photo.name}`);
        const snapshot = await uploadBytes(photoRef, photo);
        const downloadURL = await getDownloadURL(snapshot.ref);
        photoUrls.push(downloadURL);
      }
    }

    const reviewsRef = collection(db, 'reviews');
    const newReview = {
      userId,
      bookingId,
      resourceId,
      resourceType,
      rating: reviewData.rating,
      comment: reviewData.comment,
      photos: photoUrls,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await addDoc(reviewsRef, newReview);
    
    // Update booking to mark as reviewed
    const bookingRef = doc(db, 'bookings', bookingId);
    await updateDoc(bookingRef, {
      hasReviewed: true,
      reviewId: docRef.id
    });

    return { id: docRef.id, ...newReview };
  } catch (error) {
    console.error('Error creating review:', error);
    throw error;
  }
};

// Get reviews for a specific resource
export const getReviewsByResourceId = async (resourceId: string): Promise<Review[]> => {
  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('resourceId', '==', resourceId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
};

// Get reviews by user ID
export const getReviewsByUserId = async (userId: string): Promise<Review[]> => {
  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    return [];
  }
};

// Add provider reply to review
export const addProviderReply = async (
  reviewId: string,
  providerId: string,
  replyComment: string
): Promise<void> => {
  try {
    const reviewRef = doc(db, 'reviews', reviewId);
    const reply: ProviderReply = {
      id: `reply-${Date.now()}`,
      providerId,
      comment: replyComment,
      createdAt: new Date().toISOString()
    };

    await updateDoc(reviewRef, { reply });
  } catch (error) {
    console.error('Error adding provider reply:', error);
    throw error;
  }
};

// Get user bookings (completed ones eligible for review)
export const getUserBookings = async (userId: string): Promise<UserBooking[]> => {
  try {
    const bookingsRef = collection(db, 'bookings');
    const q = query(
      bookingsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const bookings = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserBooking[];
    
    // Filter completed bookings (checkout date has passed)
    const now = new Date();
    return bookings.filter(booking => {
      const checkoutDate = new Date(booking.checkoutDate || booking.endDate);
      return checkoutDate < now && booking.status !== 'cancelled';
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    return [];
  }
};

// Calculate average rating for a resource
export const calculateAverageRating = (reviews: Review[]): number => {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10; // Round to 1 decimal place
};
