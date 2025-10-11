import type { Review } from './review';
import type { CottageMonthlyPricing } from './seasonalPricing';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'PROVIDER_ADMIN' | 'CUSTOMER';
  isActive: boolean;
  phoneNumber?: string;
  personalId?: string;
  password?: string; // პაროლი
  address?: string;
  notes?: string;
  physicalAddress?: string; // ფიზიკური მისამართი
  personalNote?: string; // პერსონალური მოკლე აღწერა
  createdAt: Date;
  updatedAt: Date;
  // წესების დათანხმება
  agreedToTerms?: boolean;
  termsAgreedAt?: Date;
  // ადმინისტრატორის კონტროლისთვის
  addedBy?: string; // ვინ დაამატა (user ID)
  registrationStatus: 'active' | 'inactive' | 'cancelled';
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'PROVIDER_ADMIN' | 'CUSTOMER';
  phoneNumber?: string;
  personalId?: string;
  agreedToTerms?: boolean;
  termsAgreedAt?: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  resourceType: 'cottage' | 'hotel' | 'vehicle' | 'booking' | 'user';
  resourceId: string;
  oldData?: any;
  newData?: any;
  timestamp: Date;
  ipAddress?: string;
}

export interface Cottage {
  id?: string;
  name: string;
  description: string;
  images: string[];
  pricePerNight: number;
  maxGuests: number;
  amenities: string[];
  location: string;
  available: boolean;
  providerId: string;
  createdAt: Date;
  updatedAt?: Date;
  reviews?: Review[];
  averageRating?: number;
  totalReviews?: number;
  customPricing?: {
    [key: string]: number;
  };
  monthlyPricing?: CottageMonthlyPricing;
  bankName?: string;
  bankAccount?: string;
  bankAccountInfo?: {
    bank: string;
    accountNumber: string;
    accountHolderName: string;
    accountId?: string;
  };
}