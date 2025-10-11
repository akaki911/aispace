import type { Review } from './review';
import type { HotelMonthlyPricing } from './seasonalPricing';

export interface RoomType {
  id: string;
  name: string;
  pricePerNight: number;
  capacity: number;
  description: string;
  amenities: string[];
}

export interface Hotel {
  id?: string;
  name: string;
  description: string;
  location: string;
  images: string[];
  roomTypes: RoomType[];
  amenities: string[];
  providerId: string;
  createdAt: Date;
  updatedAt?: Date;
  starRating: number;
  available: boolean;
  reviews?: Review[];
  averageRating?: number;
  totalReviews?: number;
  monthlyPricing?: HotelMonthlyPricing;
  flexiblePricing?: {
    [month: string]: number;
  };
  pricingMode?: 'standard' | 'flexible';
  bankName?: string;
  bankAccount?: string;
  bankAccountInfo?: {
    bank: string;
    accountNumber: string;
    accountHolderName: string;
    accountId?: string;
  };
}

export interface HotelBooking {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string;
  phone: string;
  hotelId: string;
  hotelName: string;
  roomTypeId: string;
  roomTypeName: string;
  startDate: Date;
  endDate: Date;
  adults: number;
  children: number;
  totalPrice: number;
  depositAmount: number;
  notes: string;
  გადასახდილია: boolean;
  createdAt: Date;
  status: 'confirmed' | 'cancelled' | 'completed';
  type: 'hotel';
  resourceOwnerId?: string;
}