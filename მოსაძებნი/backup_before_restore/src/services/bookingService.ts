import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export interface Booking {
  id: string;
  providerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  resourceType: "cottage" | "hotel" | "vehicle";
  resourceName: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  depositAmount: number;
  isPaid: boolean;
  status: "active" | "cancelled" | "completed" | "pending" | "confirmed";
  rating?: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface Review {
  id: string;
  bookingId: string;
  providerId: string;
  resourceId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

interface ProviderStats {
  totalBookings: number;
  totalRevenue: number;
  pendingRevenue: number;
  averageRating: number;
  confirmedBookings: number;
  cancelledBookings: number;
  activeBookings: number;
  completedBookings: number;
  pendingBookings: number;
  paidBookings: number;
  unpaidBookings: number;
  revenuePerBooking: number;
  paymentRate: number;
  cancellationRate: number;
}

// Real Firestore functions - replace mock with these when ready
export const getBookingsByProviderId = async (
  providerId: string,
): Promise<Booking[]> => {
  try {
    const bookingsRef = collection(db, 'bookings');
    const q = query(
      bookingsRef,
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
    } as Booking));
  } catch (error) {
    console.error("Error fetching provider bookings:", error);
    return [];
  }
};

export const createBooking = async (
  bookingData: Omit<Booking, "id" | "createdAt" | "updatedAt">,
): Promise<Booking> => {
  try {
    console.log("🔄 Creating booking with data:", bookingData);

    // Validate required fields
    if (!bookingData.customerName || !bookingData.customerEmail) {
      throw new Error("Customer name and email are required");
    }

    if (!bookingData.providerId || !bookingData.resourceId) {
      throw new Error("Provider and resource information are required");
    }

    // Create booking data for Firestore
    const bookingForFirestore = {
      ...bookingData,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "pending",
    };

    const docRef = await addDoc(
      collection(db, "bookings"),
      bookingForFirestore,
    );

    if (!docRef || !docRef.id) {
      throw new Error("Firestore document creation returned empty ID");
    }

    // Update the document with its own ID
    await updateDoc(docRef, { id: docRef.id });

    console.log("✅ Booking created successfully with ID:", docRef.id);

    const newBooking: Booking = {
      ...bookingData,
      id: docRef.id,
      createdAt: bookingForFirestore.createdAt.toISOString(),
      updatedAt: bookingForFirestore.updatedAt.toISOString(),
      status: "pending",
    };

    console.log("✅ Booking created successfully:", {
      id: newBooking.id,
      customerName: newBooking.customerName,
      resourceName: newBooking.resourceName,
      status: newBooking.status,
    });

    return newBooking;
  } catch (error: any) {
    console.error("❌ Error creating booking:", error);
    console.error("❌ Booking data was:", bookingData);
    throw new Error(
      `ჯავშნის შენახვა ვერ მოხერხდა: ${error.message || "Unknown error occurred"}`,
    );
  }
};

export const updateBooking = async (
  bookingId: string,
  updates: Partial<Booking>,
): Promise<void> => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    
    // Activate timer when booking is completed
    if (updates.status === 'completed') {
      console.log("🔔 Booking completed, activating completion timer");
      
      // Set timer for additional actions after completion
      const completionTimer = setTimeout(() => {
        console.log("⏰ Booking completion timer triggered");
        
        // Add completion notification or additional logic here
        const completionEvent = new CustomEvent('bookingCompleted', {
          detail: { bookingId, completedAt: new Date().toISOString() }
        });
        window.dispatchEvent(completionEvent);
      }, 5000); // 5 second timer
      
      // Store timer reference
      await updateDoc(bookingRef, {
        completionTimerActivated: true,
        completionTimerStarted: new Date().toISOString()
      });
    }
    
    // Activate timer when invoice/payment is completed
    if (updates.isPaid === true) {
      console.log("💰 Invoice paid, activating invoice completion timer");
      
      const invoiceTimer = setTimeout(() => {
        console.log("⏰ Invoice completion timer triggered");
        
        // Add invoice completion notification or additional logic here
        const invoiceEvent = new CustomEvent('invoiceCompleted', {
          detail: { bookingId, paidAt: new Date().toISOString() }
        });
        window.dispatchEvent(invoiceEvent);
      }, 3000); // 3 second timer
      
      // Store timer reference
      await updateDoc(bookingRef, {
        invoiceTimerActivated: true,
        invoiceTimerStarted: new Date().toISOString()
      });
    }
    
    console.log("✅ Booking updated successfully:", bookingId);
  } catch (error) {
    console.error("❌ Error updating booking:", error);
    throw error;
  }
};

export const deleteBooking = async (bookingId: string): Promise<void> => {
  try {
    const bookingRef = doc(db, "bookings", bookingId);
    await deleteDoc(bookingRef);
    console.log("✅ Booking deleted successfully:", bookingId);
  } catch (error) {
    console.error("❌ Error deleting booking:", error);
    throw error;
  }
};

export const getReviewsByProviderId = async (
  providerId: string,
): Promise<Review[]> => {
  // TODO: Replace with real Firestore query
  // const reviewsRef = collection(db, 'reviews');
  // const q = query(reviewsRef, where('providerId', '==', providerId));
  // const querySnapshot = await getDocs(q);
  // return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // For now, extract ratings from bookings
  const bookings = await getBookingsByProviderId(providerId);
  return bookings
    .filter((b) => b.rating)
    .map((b) => ({
      id: `review-${b.id}`,
      bookingId: b.id,
      providerId: b.providerId,
      resourceId: b.resourceId,
      rating: b.rating!,
      createdAt: b.updatedAt,
    }));
};

// Statistics calculation functions
// Customer-specific booking functions
export const getBookingsByUser = async (
  userId: string,
  phoneNumber: string,
): Promise<any[]> => {
  try {
    console.log("📖 Loading user bookings for:", { userId, phoneNumber });

    // Load cottage bookings from 'bookings' collection
    console.log("📖 Loading cottage bookings...");
    const cottageBookingsRef = collection(db, "bookings");
    
    // Create multiple queries to find bookings by different identifiers
    const queries = [];
    
    if (phoneNumber) {
      queries.push(
        query(
          cottageBookingsRef,
          where("phone", "==", phoneNumber),
          orderBy("createdAt", "desc")
        )
      );
    }
    
    if (userId && userId !== phoneNumber) {
      // Also try to search by customerInfo.userId if it exists
      queries.push(
        query(
          cottageBookingsRef,
          where("customerInfo.userId", "==", userId),
          orderBy("createdAt", "desc")
        )
      );
    }
    
    // Execute all cottage queries
    const cottageSnapshots = await Promise.all(
      queries.map(q => getDocs(q))
    );

    // Combine all cottage booking results and remove duplicates
    const allCottageData = cottageSnapshots.flatMap(snapshot => snapshot.docs);
    const uniqueCottageData = allCottageData.filter((doc, index, arr) => 
      arr.findIndex(d => d.id === doc.id) === index
    );

    const cottageBookings = uniqueCottageData.map((doc) => {
      const data = doc.data();
      console.log("✅ Found cottage booking:", {
        id: doc.id,
        cottage: data.cottage,
        phone: data.phone,
        customerInfo: data.customerInfo,
        firstName: data.firstName,
        lastName: data.lastName,
        startDate: data.startDate,
        endDate: data.endDate,
        totalPrice: data.totalPrice || data.customTotalPrice,
        depositAmount: data.depositAmount,
        გადასახდილია: data.გადასახდილია,
        remainingAmountPaid: data.remainingAmountPaid
      });
      
      // Calculate amounts for cottage bookings
      const totalAmount = data.totalPrice || data.customTotalPrice || 0;
      const bookingAmount = data.depositAmount || Math.ceil(totalAmount * 0.3);
      const remainingAmount = totalAmount - bookingAmount;
      
      return {
        id: doc.id,
        type: 'cottage',
        cottage: data.cottage,
        checkIn: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        checkOut: data.endDate?.toDate?.()?.toISOString() || data.endDate,
        totalAmount: totalAmount,
        bookingAmount: bookingAmount,
        remainingAmount: remainingAmount,
        bookingStatus: data.გადასახდილია ? 'გადახდილი' : 'მუშავდება',
        bookingAmountStatus: data.გადასახდილია ? 'გადახდილი' : 'გადაუხდელი',
        remainingAmountStatus: data.remainingAmountPaid ? 'გადახდილი' : 'გადაუხდელი',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        adults: data.adults,
        children: data.children,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });

    console.log("📖 Loading vehicle bookings...");
    const vehicleBookingsRef = collection(db, "vehicleBookings");
    
    const vehicleQueries = [];
    
    if (phoneNumber) {
      vehicleQueries.push(
        query(
          vehicleBookingsRef,
          where("phone", "==", phoneNumber),
          orderBy("createdAt", "desc")
        )
      );
    }
    
    if (userId && userId !== phoneNumber) {
      vehicleQueries.push(
        query(
          vehicleBookingsRef,
          where("customerInfo.userId", "==", userId),
          orderBy("createdAt", "desc")
        )
      );
    }
    
    const vehicleSnapshots = await Promise.all(
      vehicleQueries.map(q => getDocs(q))
    );

    // Combine all vehicle booking results and remove duplicates
    const allVehicleData = vehicleSnapshots.flatMap(snapshot => snapshot.docs);
    const uniqueVehicleData = allVehicleData.filter((doc, index, arr) => 
      arr.findIndex(d => d.id === doc.id) === index
    );

    const vehicleBookings = uniqueVehicleData.map((doc) => {
      const data = doc.data();
      console.log("✅ Found vehicle booking:", {
        id: doc.id,
        vehicleTitle: data.vehicleTitle,
        phone: data.phone,
        customerInfo: data.customerInfo,
        firstName: data.firstName,
        lastName: data.lastName,
        startDateTime: data.startDateTime,
        endDateTime: data.endDateTime,
        totalPrice: data.totalPrice,
        გადასახდილია: data.გადასახდილია
      });
      
      const totalAmount = data.totalPrice || data.customTotalPrice || 0;
      const bookingAmount = data.depositAmount || Math.ceil(totalAmount * 0.3);
      const remainingAmount = totalAmount - bookingAmount;
      
      return {
        id: doc.id,
        type: 'vehicle',
        vehicle: data.vehicleTitle || data.vehicleId,
        checkIn: data.startDateTime?.toDate?.()?.toISOString() || data.startDateTime,
        checkOut: data.endDateTime?.toDate?.()?.toISOString() || data.endDateTime,
        totalAmount: totalAmount,
        bookingAmount: bookingAmount,
        remainingAmount: remainingAmount,
        bookingStatus: data.გადასახდილია ? 'გადახდილი' : 'მუშავდება',
        bookingAmountStatus: data.გადასახდილია ? 'გადახდილი' : 'გადაუხდელი',
        remainingAmountStatus: data.remainingAmountPaid ? 'გადახდილი' : 'გადაუხდელი',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });

    console.log("📖 Loading hotel bookings...");
    const hotelBookingsRef = collection(db, "hotelBookings");
    
    const hotelQueries = [];
    
    if (phoneNumber) {
      hotelQueries.push(
        query(
          hotelBookingsRef,
          where("phone", "==", phoneNumber),
          orderBy("createdAt", "desc")
        )
      );
    }
    
    if (userId && userId !== phoneNumber) {
      hotelQueries.push(
        query(
          hotelBookingsRef,
          where("customerInfo.userId", "==", userId),
          orderBy("createdAt", "desc")
        )
      );
    }
    
    const hotelSnapshots = await Promise.all(
      hotelQueries.map(q => getDocs(q))
    );

    // Combine all hotel booking results and remove duplicates
    const allHotelData = hotelSnapshots.flatMap(snapshot => snapshot.docs);
    const uniqueHotelData = allHotelData.filter((doc, index, arr) => 
      arr.findIndex(d => d.id === doc.id) === index
    );

    const hotelBookings = uniqueHotelData.map((doc) => {
      const data = doc.data();
      console.log("✅ Found hotel booking:", {
        id: doc.id,
        hotelName: data.hotelName,
        phone: data.phone,
        customerInfo: data.customerInfo,
        firstName: data.firstName,
        lastName: data.lastName,
        startDate: data.startDate,
        endDate: data.endDate,
        totalPrice: data.totalPrice,
        გადასახდილია: data.გადასახდილია
      });
      
      const totalAmount = data.totalPrice || data.customTotalPrice || 0;
      const bookingAmount = data.depositAmount || Math.ceil(totalAmount * 0.3);
      const remainingAmount = totalAmount - bookingAmount;
      
      return {
        id: doc.id,
        type: 'hotel',
        hotel: data.hotelName || data.hotelId,
        checkIn: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        checkOut: data.endDate?.toDate?.()?.toISOString() || data.endDate,
        totalAmount: totalAmount,
        bookingAmount: bookingAmount,
        remainingAmount: remainingAmount,
        bookingStatus: data.გადასახდილია ? 'გადახდილი' : 'მუშავდება',
        bookingAmountStatus: data.გადასახდილია ? 'გადახდილი' : 'გადაუხდელი',
        remainingAmountStatus: data.remainingAmountPaid ? 'გადახდილი' : 'გადაუხდელი',
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        roomTypeName: data.roomTypeName,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });

    const allBookings = [
      ...cottageBookings,
      ...vehicleBookings,
      ...hotelBookings,
    ].sort((a, b) => {
      // Sort by creation date, newest first
      const aDate = new Date(a.createdAt || 0);
      const bDate = new Date(b.createdAt || 0);
      return bDate.getTime() - aDate.getTime();
    });

    console.log(`✅ Total bookings loaded: ${allBookings.length}`, allBookings);
    return allBookings;
  } catch (error) {
    console.error("❌ Error loading user bookings:", error);
    return [];
  }
};

export const getCottages = async (): Promise<any[]> => {
  try {
    const cottagesRef = collection(db, "cottages");
    const snapshot = await getDocs(cottagesRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error loading cottages:", error);
    return [];
  }
};

export const getVehicles = async (): Promise<any[]> => {
  try {
    const vehiclesRef = collection(db, "vehicles");
    const snapshot = await getDocs(vehiclesRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error loading vehicles:", error);
    return [];
  }
};

export const getHotels = async (): Promise<any[]> => {
  try {
    const hotelsRef = collection(db, "hotels");
    const snapshot = await getDocs(hotelsRef);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error loading hotels:", error);
    return [];
  }
};

export const calculateProviderStats = (bookings: Booking[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalBookings = bookings.length;
  const paidBookings = bookings.filter((b) => b.isPaid).length;
  const unpaidBookings = totalBookings - paidBookings;

  // Total revenue from paid bookings only
  const totalRevenue = bookings
    .filter((b) => b.isPaid)
    .reduce((sum, booking) => sum + booking.totalAmount, 0);

  // Pending revenue from unpaid but active/confirmed bookings
  const pendingRevenue = bookings
    .filter(
      (b) => !b.isPaid && ["pending", "active", "confirmed"].includes(b.status),
    )
    .reduce((sum, booking) => sum + booking.totalAmount, 0);

  // Average rating calculation from actual ratings
  const ratingsArray = bookings
    .filter((b) => b.rating && b.rating > 0)
    .map((b) => b.rating!);
  const averageRating =
    ratingsArray.length > 0
      ? Math.round(
          (ratingsArray.reduce((sum, rating) => sum + rating, 0) /
            ratingsArray.length) *
            10,
        ) / 10
      : 0;

  // Status-based calculations
  const confirmedBookings = bookings.filter((b) =>
    ["confirmed", "active"].includes(b.status),
  ).length;
  const cancelledBookings = bookings.filter(
    (b) => b.status === "cancelled",
  ).length;
  const completedBookings = bookings.filter(
    (b) => b.status === "completed",
  ).length;
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;

  // Active bookings: end date is today or in the future AND status is active/confirmed
  const activeBookings = bookings.filter((b) => {
    const endDate = new Date(b.endDate);
    return endDate >= today && ["active", "confirmed"].includes(b.status);
  }).length;

  // Completed bookings: status is completed OR end date is in the past
  const reallyCompletedBookings = bookings.filter((b) => {
    const endDate = new Date(b.endDate);
    return (
      b.status === "completed" || (endDate < today && b.status !== "cancelled")
    );
  }).length;

  return {
    totalBookings,
    totalRevenue,
    pendingRevenue,
    averageRating,
    confirmedBookings,
    cancelledBookings,
    activeBookings,
    completedBookings: reallyCompletedBookings,
    pendingBookings,
    paidBookings,
    unpaidBookings,
    // Additional useful stats
    revenuePerBooking:
      totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0,
    paymentRate:
      totalBookings > 0 ? Math.round((paidBookings / totalBookings) * 100) : 0,
    cancellationRate:
      totalBookings > 0
        ? Math.round((cancelledBookings / totalBookings) * 100)
        : 0,
  };
};
