
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getBookingsByProviderId, 
  createBooking, 
  updateBooking, 
  deleteBooking,
  getBookingsByUser,
  type Booking 
} from '../services/bookingService';
import { realTimeService } from '../services/realTimeService';
import { useEffect } from 'react';

// Query keys
export const bookingKeys = {
  all: ['bookings'] as const,
  provider: (providerId: string) => [...bookingKeys.all, 'provider', providerId] as const,
  user: (userId: string, phoneNumber: string) => [...bookingKeys.all, 'user', userId, phoneNumber] as const,
};

// Provider bookings query with real-time updates
export const useProviderBookings = (providerId: string, enableRealTime = false) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: bookingKeys.provider(providerId),
    queryFn: () => getBookingsByProviderId(providerId),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enableRealTime || !providerId) return;

    const subscriptionId = realTimeService.subscribeToProviderBookings(
      providerId,
      (bookings) => {
        queryClient.setQueryData(bookingKeys.provider(providerId), bookings);
      },
      (error) => {
        console.error('Real-time provider bookings error:', error);
      }
    );

    return () => {
      realTimeService.unsubscribe(subscriptionId);
    };
  }, [providerId, enableRealTime, queryClient]);

  return query;
};

// User bookings query with real-time updates
export const useUserBookings = (userId: string, phoneNumber: string, enableRealTime = false) => {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: bookingKeys.user(userId, phoneNumber),
    queryFn: () => getBookingsByUser(userId, phoneNumber),
    enabled: !!phoneNumber,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enableRealTime || !phoneNumber) return;

    const subscriptionId = realTimeService.subscribeToUserBookings(
      phoneNumber,
      (bookings) => {
        queryClient.setQueryData(bookingKeys.user(userId, phoneNumber), bookings);
      },
      (error) => {
        console.error('Real-time user bookings error:', error);
      }
    );

    return () => {
      realTimeService.unsubscribe(subscriptionId);
    };
  }, [userId, phoneNumber, enableRealTime, queryClient]);

  return query;
};

// Create booking mutation
export const useCreateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>) => 
      createBooking(bookingData),
    onSuccess: (newBooking) => {
      // Invalidate and refetch provider bookings
      queryClient.invalidateQueries({ queryKey: bookingKeys.provider(newBooking.providerId) });
      
      // Invalidate user bookings if customer info is available
      if (newBooking.customerPhone) {
        queryClient.invalidateQueries({ 
          queryKey: ['bookings', 'user', newBooking.customerPhone] 
        });
      }

      console.log('✅ Booking created and cache updated:', newBooking.id);
    },
    onError: (error) => {
      console.error('❌ Booking creation failed:', error);
    },
  });
};

// Update booking mutation
export const useUpdateBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, updates }: { bookingId: string; updates: Partial<Booking> }) =>
      updateBooking(bookingId, updates),
    onSuccess: (_, { bookingId }) => {
      // Invalidate all booking queries that might contain this booking
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      
      console.log('✅ Booking updated and cache invalidated:', bookingId);
    },
    onError: (error) => {
      console.error('❌ Booking update failed:', error);
    },
  });
};

// Delete booking mutation
export const useDeleteBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => deleteBooking(bookingId),
    onSuccess: (_, bookingId) => {
      // Invalidate all booking queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      
      console.log('✅ Booking deleted and cache updated:', bookingId);
    },
    onError: (error) => {
      console.error('❌ Booking deletion failed:', error);
    },
  });
};

// Prefetch provider bookings
export const usePrefetchProviderBookings = () => {
  const queryClient = useQueryClient();

  return (providerId: string) => {
    queryClient.prefetchQuery({
      queryKey: bookingKeys.provider(providerId),
      queryFn: () => getBookingsByProviderId(providerId),
      staleTime: 5 * 60 * 1000,
    });
  };
};
