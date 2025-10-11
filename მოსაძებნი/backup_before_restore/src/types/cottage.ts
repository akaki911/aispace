export interface Cottage {
  id?: string;
  name: string;
  description: string;
  image: string;
  location: string;
  price: number;
  amenities: string[];
  latitude: number;
  longitude: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  hasWifi: boolean;
  hasParking: boolean;
  hasPool: boolean;
  hasKitchen: boolean;
  checkInTime: string;
  checkOutTime: string;
  isAvailable: boolean;
  providerId: string;
  hasSeasonalPricing?: boolean;
  seasonalPricing?: {
    winterPrice?: number;
    springPrice?: number;
    summerPrice?: number;
    autumnPrice?: number;
  };
  flexiblePricing?: {
    [month: string]: { min: number; max: number };
  };
  pricingMode?: 'standard' | 'flexible';
  bankInfo?: {
    bank: string;
    accountNumber: string;
    accountHolderName: string;
    accountId?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}