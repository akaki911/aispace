
import { useState, useEffect, useCallback } from 'react';
import { 
  getBookingsByProviderId, 
  createBooking, 
  updateBooking, 
  deleteBooking,
  getBookingsByUser,
  type Booking 
} from '../services/bookingService';
import { realTimeService } from '../services/realTimeService';

// Simple cache keys for identification
export const bookingKeys = {
  all: ['bookings'] as const,
  provider: (providerId: string) => [...bookingKeys.all, 'provider', providerId] as const,
  user: (userId: string, phoneNumber: string) => [...bookingKeys.all, 'user', userId, phoneNumber] as const,
};

// Provider bookings hook with real-time updates
export const useProviderBookings = (providerId: string, enableRealTime = false) => {
  const [data, setData] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchData = useCallback(async () => {
    if (!providerId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const bookings = await getBookingsByProviderId(providerId);
      setData(bookings);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!enableRealTime || !providerId) return;

    const subscriptionId = realTimeService.subscribeToProviderBookings(
      providerId,
      (bookings) => {
        setData(bookings);
      },
      (error) => {
        console.error('Real-time provider bookings error:', error);
        setError(error);
      }
    );

    return () => {
      realTimeService.unsubscribe(subscriptionId);
    };
  }, [providerId, enableRealTime]);

  return { data, isLoading, error, refetch: fetchData };
};

// User bookings hook with real-time updates
export const useUserBookings = (userId: string, phoneNumber: string, enableRealTime = false) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchData = useCallback(async () => {
    if (!phoneNumber) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const bookings = await getBookingsByUser(userId, phoneNumber);
      setData(bookings);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, phoneNumber]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!enableRealTime || !phoneNumber) return;

    const subscriptionId = realTimeService.subscribeToUserBookings(
      phoneNumber,
      (bookings) => {
        setData(bookings);
      },
      (error) => {
        console.error('Real-time user bookings error:', error);
        setError(error);
      }
    );

    return () => {
      realTimeService.unsubscribe(subscriptionId);
    };
  }, [userId, phoneNumber, enableRealTime]);

  return { data, isLoading, error, refetch: fetchData };
};

// Create booking mutation replacement
export const useCreateBooking = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>,
    options?: {
      onSuccess?: (data: Booking) => void;
      onError?: (error: Error) => void;
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const newBooking = await createBooking(bookingData);
      console.log('✅ Booking created:', newBooking.id);
      
      if (options?.onSuccess) {
        options.onSuccess(newBooking);
      }
      
      return newBooking;
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('❌ Booking creation failed:', error);
      
      if (options?.onError) {
        options.onError(error);
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
};

// Update booking mutation replacement
export const useUpdateBooking = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    { bookingId, updates }: { bookingId: string; updates: Partial<Booking> },
    options?: {
      onSuccess?: () => void;
      onError?: (error: Error) => void;
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      await updateBooking(bookingId, updates);
      console.log('✅ Booking updated:', bookingId);
      
      if (options?.onSuccess) {
        options.onSuccess();
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('❌ Booking update failed:', error);
      
      if (options?.onError) {
        options.onError(error);
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
};

// Delete booking mutation replacement
export const useDeleteBooking = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    bookingId: string,
    options?: {
      onSuccess?: () => void;
      onError?: (error: Error) => void;
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      await deleteBooking(bookingId);
      console.log('✅ Booking deleted:', bookingId);
      
      if (options?.onSuccess) {
        options.onSuccess();
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      console.error('❌ Booking deletion failed:', error);
      
      if (options?.onError) {
        options.onError(error);
      }
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { mutate, isLoading, error };
};

// Prefetch provider bookings replacement
export const usePrefetchProviderBookings = () => {
  return useCallback((providerId: string) => {
    // Simple prefetch - just call the service directly
    getBookingsByProviderId(providerId)
      .then(() => console.log('✅ Prefetched bookings for provider:', providerId))
      .catch(err => console.error('❌ Prefetch failed:', err));
  }, []);
};
