
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  DocumentData,
  QuerySnapshot,
  FirestoreError
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

type SubscriptionCallback<T> = (data: T[]) => void;
type ErrorCallback = (error: FirestoreError) => void;

class RealTimeService {
  private unsubscribers: Map<string, () => void> = new Map();

  // Real-time bookings for provider
  subscribeToProviderBookings(
    providerId: string,
    callback: SubscriptionCallback<any>,
    onError?: ErrorCallback
  ): string {
    const subscriptionId = `provider-bookings-${providerId}`;
    
    const q = query(
      collection(db, 'bookings'),
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const bookings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        }));
        callback(bookings);
      },
      (error: FirestoreError) => {
        console.error('Real-time bookings error:', error);
        if (onError) onError(error);
      }
    );

    this.unsubscribers.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // Real-time cottages
  subscribeToCottages(
    callback: SubscriptionCallback<any>,
    onError?: ErrorCallback
  ): string {
    const subscriptionId = `cottages-${Date.now()}`;
    
    const q = query(
      collection(db, 'cottages'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const cottages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(cottages);
      },
      (error: FirestoreError) => {
        console.error('Real-time cottages error:', error);
        if (onError) onError(error);
      }
    );

    this.unsubscribers.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // Real-time vehicles
  subscribeToVehicles(
    callback: SubscriptionCallback<any>,
    onError?: ErrorCallback
  ): string {
    const subscriptionId = `vehicles-${Date.now()}`;
    
    const q = query(
      collection(db, 'vehicles'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const vehicles = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(vehicles);
      },
      (error: FirestoreError) => {
        console.error('Real-time vehicles error:', error);
        if (onError) onError(error);
      }
    );

    this.unsubscribers.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // Real-time hotels
  subscribeToHotels(
    callback: SubscriptionCallback<any>,
    onError?: ErrorCallback
  ): string {
    const subscriptionId = `hotels-${Date.now()}`;
    
    const q = query(
      collection(db, 'hotels'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const hotels = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(hotels);
      },
      (error: FirestoreError) => {
        console.error('Real-time hotels error:', error);
        if (onError) onError(error);
      }
    );

    this.unsubscribers.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // Real-time user bookings
  subscribeToUserBookings(
    phoneNumber: string,
    callback: SubscriptionCallback<any>,
    onError?: ErrorCallback
  ): string {
    const subscriptionId = `user-bookings-${phoneNumber}`;
    
    // Subscribe to cottage bookings
    const cottageQ = query(
      collection(db, 'bookings'),
      where('phone', '==', phoneNumber),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeCottages = onSnapshot(cottageQ, 
      (snapshot) => {
        const cottageBookings = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'cottage',
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          };
        });

        // Also get vehicle and hotel bookings
        this.getUserVehicleBookings(phoneNumber, (vehicleBookings) => {
          this.getUserHotelBookings(phoneNumber, (hotelBookings) => {
            const allBookings = [...cottageBookings, ...vehicleBookings, ...hotelBookings]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            callback(allBookings);
          });
        });
      },
      onError
    );

    this.unsubscribers.set(subscriptionId, unsubscribeCottages);
    return subscriptionId;
  }

  private getUserVehicleBookings(phoneNumber: string, callback: SubscriptionCallback<any>) {
    const q = query(
      collection(db, 'vehicleBookings'),
      where('phone', '==', phoneNumber),
      orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        type: 'vehicle',
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      }));
      callback(bookings);
    });
  }

  private getUserHotelBookings(phoneNumber: string, callback: SubscriptionCallback<any>) {
    const q = query(
      collection(db, 'hotelBookings'),
      where('phone', '==', phoneNumber),
      orderBy('createdAt', 'desc')
    );

    onSnapshot(q, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({
        id: doc.id,
        type: 'hotel',
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
      }));
      callback(bookings);
    });
  }

  // Unsubscribe from specific subscription
  unsubscribe(subscriptionId: string): void {
    const unsubscriber = this.unsubscribers.get(subscriptionId);
    if (unsubscriber) {
      unsubscriber();
      this.unsubscribers.delete(subscriptionId);
      console.log(`✅ Unsubscribed from: ${subscriptionId}`);
    }
  }

  // Unsubscribe from all subscriptions
  unsubscribeAll(): void {
    this.unsubscribers.forEach((unsubscriber, subscriptionId) => {
      unsubscriber();
      console.log(`✅ Unsubscribed from: ${subscriptionId}`);
    });
    this.unsubscribers.clear();
  }

  // Get active subscriptions count
  getActiveSubscriptionsCount(): number {
    return this.unsubscribers.size;
  }

  // Get active subscription IDs
  getActiveSubscriptions(): string[] {
    return Array.from(this.unsubscribers.keys());
  }
}

export const realTimeService = new RealTimeService();
