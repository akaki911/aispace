
export interface Customer {
  id: string;
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  totalBookings: number;
  totalSpent: number;
  lastBookingDate?: Date;
  notes?: string;
  registrationSource: 'PHONE' | 'EMAIL' | 'ADMIN_CREATED';
}

export interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  averageBookingsPerCustomer: number;
  topCustomersByBookings: Customer[];
  topCustomersBySpending: Customer[];
}
