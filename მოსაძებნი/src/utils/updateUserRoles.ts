
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const updateUserRole = async (userId: string, role: 'CUSTOMER' | 'ADMIN' | 'PROVIDER_ADMIN' | 'SUPER_ADMIN') => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      role: role,
      updatedAt: new Date().toISOString()
    });
    console.log(`✅ User ${userId} role updated to ${role}`);
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    throw error;
  }
};

// Helper function to update Nino's role specifically
export const updateNinoRole = async () => {
  try {
    await updateUserRole('WvLF8CPVfdYngwfd3s2R', 'CUSTOMER');
    console.log('✅ Nino\'s role updated to CUSTOMER');
  } catch (error) {
    console.error('❌ Error updating Nino\'s role:', error);
  }
};
