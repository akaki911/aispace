
export interface Review {
  id: string;
  userId: string;
  bookingId: string;
  resourceId: string;
  resourceType: 'cottage' | 'hotel' | 'vehicle';
  rating: number; // 1-10 scale
  comment: string;
  photos: string[]; // max 2 photos
  createdAt: string;
  updatedAt: string;
  reply?: ProviderReply;
}

export interface ProviderReply {
  id: string;
  providerId: string;
  comment: string;
  createdAt: string;
}

export interface ReviewFormData {
  rating: number;
  comment: string;
  photos: File[];
}

export interface UserBooking {
  id: string;
  resourceId: string;
  resourceType: 'cottage' | 'hotel' | 'vehicle';
  resourceName: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  status: 'active' | 'completed' | 'cancelled';
  checkoutDate: string;
  hasReviewed: boolean;
  reviewId?: string;
  createdAt: string;
}
