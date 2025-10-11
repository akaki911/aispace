
import { z } from 'zod';

// Booking validation schema
export const bookingSchema = z.object({
  customerName: z.string().min(2, 'სახელი უნდა იყოს მინიმუმ 2 სიმბოლო'),
  customerEmail: z.string().email('არასწორი ელ-ფოსტის ფორმატი'),
  customerPhone: z.string().regex(/^5\d{8}$/, 'ტელეფონი უნდა იწყებოდეს 5-ით და შეიცავდეს 9 ციფრს'),
  startDate: z.string().refine(date => new Date(date) > new Date(), 'დაწყების თარიღი უნდა იყოს მომავალში'),
  endDate: z.string().refine(date => new Date(date) > new Date(), 'დასრულების თარიღი უნდა იყოს მომავალში'),
  totalAmount: z.number().positive('თანხა უნდა იყოს დადებითი'),
  depositAmount: z.number().positive('დეპოზიტი უნდა იყოს დადებითი'),
  providerId: z.string().min(1, 'პროვაიდერი აუცილებელია'),
  resourceId: z.string().min(1, 'რესურსი აუცილებელია'),
  resourceType: z.enum(['cottage', 'hotel', 'vehicle'], {
    errorMap: () => ({ message: 'არასწორი რესურსის ტიპი' })
  }),
  resourceName: z.string().min(1, 'რესურსის სახელი აუცილებელია'),
  notes: z.string().optional()
}).refine(data => new Date(data.endDate) > new Date(data.startDate), {
  message: 'დასრულების თარიღი უნდა იყოს დაწყების თარიღის შემდეგ',
  path: ['endDate']
});

// Cottage validation schema
export const cottageSchema = z.object({
  name: z.string().min(2, 'კოტეჯის სახელი უნდა იყოს მინიმუმ 2 სიმბოლო'),
  description: z.string().min(10, 'აღწერა უნდა იყოს მინიმუმ 10 სიმბოლო'),
  location: z.string().min(2, 'მდებარეობა აუცილებელია'),
  price: z.number().positive('ფასი უნდა იყოს დადებითი'),
  maxGuests: z.number().min(1, 'სტუმრების რაოდენობა უნდა იყოს მინიმუმ 1'),
  bedrooms: z.number().min(1, 'საძინებლების რაოდენობა უნდა იყოს მინიმუმ 1'),
  bathrooms: z.number().min(1, 'აბაზანების რაოდენობა უნდა იყოს მინიმუმ 1'),
  latitude: z.number().min(-90).max(90, 'არასწორი გრძედი'),
  longitude: z.number().min(-180).max(180, 'არასწორი განედი'),
  amenities: z.array(z.string()).min(1, 'მინიმუმ ერთი კომფორტი აუცილებელია'),
  checkInTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'არასწორი დროის ფორმატი'),
  checkOutTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'არასწორი დროის ფორმატი'),
  providerId: z.string().min(1, 'პროვაიდერი აუცილებელია'),
  image: z.string().url('არასწორი სურათის URL'),
  hasWifi: z.boolean(),
  hasParking: z.boolean(),
  hasPool: z.boolean(),
  hasKitchen: z.boolean(),
  isAvailable: z.boolean()
});

// Vehicle validation schema
export const vehicleSchema = z.object({
  make: z.string().min(1, 'მარკა აუცილებელია'),
  model: z.string().min(1, 'მოდელი აუცილებელია'),
  year: z.number().min(1990).max(new Date().getFullYear() + 1, 'არასწორი წელი'),
  pricePerDay: z.number().positive('დღის ფასი უნდა იყოს დადებითი'),
  seats: z.number().min(1, 'ადგილების რაოდენობა აუცილებელია'),
  fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid']),
  transmission: z.enum(['manual', 'automatic']),
  providerId: z.string().min(1, 'პროვაიდერი აუცილებელია'),
  location: z.string().min(1, 'მდებარეობა აუცილებელია'),
  isAvailable: z.boolean(),
  image: z.string().url('არასწორი სურათის URL')
});

// User validation schema
export const userSchema = z.object({
  firstName: z.string().min(2, 'სახელი უნდა იყოს მინიმუმ 2 სიმბოლო'),
  lastName: z.string().min(2, 'გვარი უნდა იყოს მინიმუმ 2 სიმბოლო'),
  email: z.string().email('არასწორი ელ-ფოსტის ფორმატი'),
  phoneNumber: z.string().regex(/^5\d{8}$/, 'ტელეფონი უნდა იწყებოდეს 5-ით და შეიცავდეს 9 ციფრს'),
  personalId: z.string().regex(/^\d{11}$/, 'პირადი ნომერი უნდა შეიცავდეს ზუსტად 11 ციფრს'),
  role: z.enum(['CUSTOMER', 'PROVIDER', 'ADMIN', 'SUPER_ADMIN'])
});

// Commission validation schema
export const commissionSchema = z.object({
  bookingId: z.string().min(1, 'ჯავშნის ID აუცილებელია'),
  totalPrice: z.number().positive('საერთო ფასი უნდა იყოს დადებითი'),
  rate: z.number().min(0).max(1, 'კომისიის განაკვეთი უნდა იყოს 0-დან 1-მდე'),
  commissionAmount: z.number().positive('კომისიის თანხა უნდა იყოს დადებითი'),
  status: z.enum(['pending', 'paid', 'cancelled'])
});

// Hotel validation schema
export const hotelSchema = z.object({
  name: z.string().min(2, 'სასტუმროს სახელი უნდა იყოს მინიმუმ 2 სიმბოლო'),
  description: z.string().min(10, 'აღწერა უნდა იყოს მინიმუმ 10 სიმბოლო'),
  location: z.string().min(2, 'მდებარეობა აუცილებელია'),
  totalRooms: z.number().min(1, 'ოთახების რაოდენობა უნდა იყოს მინიმუმ 1'),
  amenities: z.array(z.string()).min(1, 'მინიმუმ ერთი კომფორტი აუცილებელია'),
  latitude: z.number().min(-90).max(90, 'არასწორი გრძედი'),
  longitude: z.number().min(-180).max(180, 'არასწორი განედი'),
  providerId: z.string().min(1, 'პროვაიდერი აუცილებელია'),
  image: z.string().url('არასწორი სურათის URL'),
  checkInTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'არასწორი დროის ფორმატი'),
  checkOutTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'არასწორი დროის ფორმატი'),
  isAvailable: z.boolean()
});

// Validation helper functions
export const validateBooking = (data: unknown) => bookingSchema.safeParse(data);
export const validateCottage = (data: unknown) => cottageSchema.safeParse(data);
export const validateVehicle = (data: unknown) => vehicleSchema.safeParse(data);
export const validateUser = (data: unknown) => userSchema.safeParse(data);
export const validateCommission = (data: unknown) => commissionSchema.safeParse(data);
export const validateHotel = (data: unknown) => hotelSchema.safeParse(data);
