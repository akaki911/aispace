// User Management Service for Role-based Authentication
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

class UserService {
  constructor() {
    this.db = getFirestore();
  }

  // Create or update user with role
  async createUser({ userId, email, role = 'CUSTOMER', status = 'active' }) {
    try {
      const userData = {
        userId,
        email,
        role, // SUPER_ADMIN, PROVIDER, CUSTOMER
        status, // active, inactive, suspended
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await this.db.collection('users').doc(userId).set(userData, { merge: true });
      console.log(`👤 [USER] Created/updated user ${userId} with role ${role}`);
      return userData;
    } catch (error) {
      console.error('❌ [USER] Create user error:', error);
      throw error;
    }
  }

  // Get user by ID
  async getUser(userId) {
    try {
      const userDoc = await this.db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return null;
      }
      return { id: userDoc.id, ...userDoc.data() };
    } catch (error) {
      console.error('❌ [USER] Get user error:', error);
      throw error;
    }
  }

  // Update user role
  async updateUserRole(userId, role) {
    try {
      await this.db.collection('users').doc(userId).update({
        role,
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log(`👤 [USER] Updated role for ${userId} to ${role}`);
    } catch (error) {
      console.error('❌ [USER] Update role error:', error);
      throw error;
    }
  }

  // List users by role
  async getUsersByRole(role) {
    try {
      const snapshot = await this.db.collection('users')
        .where('role', '==', role)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('❌ [USER] Get users by role error:', error);
      throw error;
    }
  }
}

module.exports = new UserService();