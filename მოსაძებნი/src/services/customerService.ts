import { Customer, CustomerStats } from '../types/customer';

// Mock customer database
const mockCustomers: Customer[] = [];

export const getAllCustomers = async (): Promise<Customer[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return [...mockCustomers];
};

export const getCustomerStats = async (): Promise<CustomerStats> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeCustomers = mockCustomers.filter(c => c.isActive);
  const newThisMonth = mockCustomers.filter(c => c.createdAt >= thisMonth);

  const totalBookings = mockCustomers.reduce((sum, c) => sum + c.totalBookings, 0);
  const averageBookings = mockCustomers.length > 0 ? totalBookings / mockCustomers.length : 0;

  const topByBookings = [...mockCustomers]
    .sort((a, b) => b.totalBookings - a.totalBookings)
    .slice(0, 5);

  const topBySpending = [...mockCustomers]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  return {
    totalCustomers: mockCustomers.length,
    activeCustomers: activeCustomers.length,
    newCustomersThisMonth: newThisMonth.length,
    averageBookingsPerCustomer: Math.round(averageBookings * 10) / 10,
    topCustomersByBookings: topByBookings,
    topCustomersBySpending: topBySpending
  };
};

export const createCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalBookings' | 'totalSpent'>): Promise<Customer> => {
  const newCustomer: Customer = {
    ...customerData,
    id: `customer-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalBookings: 0,
    totalSpent: 0
  };

  mockCustomers.push(newCustomer);
  return newCustomer;
};

export const updateCustomer = async (customerId: string, updates: Partial<Customer>): Promise<void> => {
  const index = mockCustomers.findIndex(c => c.id === customerId);
  if (index !== -1) {
    mockCustomers[index] = { ...mockCustomers[index], ...updates, updatedAt: new Date() };
  }
};

export const deleteCustomer = async (customerId: string): Promise<void> => {
  const index = mockCustomers.findIndex(c => c.id === customerId);
  if (index !== -1) {
    mockCustomers.splice(index, 1);
  }
};

export const authenticateByPhone = async (phoneNumber: string): Promise<Customer | null> => {
  console.log('📞 Phone authentication attempt:', phoneNumber);
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('📋 Available customers:', mockCustomers.map(c => ({ 
    phone: c.phoneNumber, 
    name: `${c.firstName} ${c.lastName}`,
    active: c.isActive 
  })));

  const customer = mockCustomers.find(c => c.phoneNumber === phoneNumber && c.isActive);
  console.log('👤 Customer found:', !!customer);
  
  if (customer) {
    console.log('✅ Phone authentication successful:', customer.firstName, customer.lastName);
  } else {
    console.log('❌ No active customer found with phone:', phoneNumber);
  }
  
  return customer || null;
};