export interface Vehicle {
  id: string;
  title: string;
  brand: string;
  model: string;
  description: string;
  images: string[];
  mainImageIndex: number;
  requiresDriver: boolean;
  pricePerHour: number;
  pricePerDay: number;
  excursionServices?: {
    minRate: number;
    maxRate: number;
    description: string;
  };
  capacity: number;
  fuelType: string;
  transmission: string;
  year: number;
  bodyType: string;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
  // ბანკის ანგარიშის ინფორმაცია
  bankAccount?: {
    bank: string;
    accountNumber: string;
    accountHolderName: string;
    accountId?: string;
  };
}

export interface VehicleBooking {
  id: string;
  firstName: string;
  lastName: string;
  personalId: string;
  phone: string;
  vehicleId: string;
  vehicleTitle: string;
  startDateTime: Date;
  endDateTime: Date;
  totalHours: number;
  fullDays: number;
  extraHours: number;
  totalPrice: number;
  depositAmount: number;
  notes: string;
  excursionType?: string;
  pickupLocation: string;
  dropoffLocation: string;
  გადასახდილია: boolean;
  createdAt: Date;
  status: 'confirmed' | 'cancelled' | 'completed';
  type: 'vehicle';
  resourceOwnerId?: string;
}