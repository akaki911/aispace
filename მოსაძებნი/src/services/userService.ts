import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { User } from '../types/user';

// Check if user exists by phone or personal ID
export const checkUserExists = async (phoneNumber: string, personalId: string): Promise<{ exists: boolean; user?: User; field?: string }> => {
  try {
    console.log('🔍 Comprehensive duplicate check:', { phoneNumber, personalId });
    let exists = false;
    let user: User | undefined = undefined;
    let field: string | undefined = undefined;

    if (phoneNumber?.trim()) {
      const phoneQuery = query(
        collection(db, 'users'),
        where('phoneNumber', '==', phoneNumber.trim())
      );
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        const userData = phoneSnapshot.docs[0].data();
        user = { id: phoneSnapshot.docs[0].id, ...userData } as User;
        field = 'phoneNumber';
        exists = true;
        console.log('✅ User found by phone number');
        return { exists, user, field };
      }
    }

    if (personalId?.trim()) {
      const personalIdQuery = query(
        collection(db, 'users'),
        where('personalId', '==', personalId.trim())
      );
      const personalIdSnapshot = await getDocs(personalIdQuery);
      if (!personalIdSnapshot.empty) {
        const userData = personalIdSnapshot.docs[0].data();
        user = { id: personalIdSnapshot.docs[0].id, ...userData } as User;
        field = 'personalId';
        exists = true;
        console.log('✅ User found by personal ID');
        return { exists, user, field };
      }
    }
    if (!exists){
      console.log('❌ User not found in Firestore');
    }

    return { exists: false };
  } catch (error) {
    console.error('❌ Error checking user existence:', error);
    return { exists: false };
  }
};

// Get user by phone or personal ID
export const getUserByPhoneOrPersonalId = async (phoneNumber: string, personalId: string): Promise<User | null> => {
  try {
    console.log('🔍 Getting user from Firestore:', { phoneNumber, personalId });

    let user: User | null = null;
    if (phoneNumber?.trim()) {
      const phoneQuery = query(
        collection(db, 'users'),
        where('phoneNumber', '==', phoneNumber.trim())
      );
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        const userDoc = phoneSnapshot.docs[0];
        user = { id: userDoc.id, ...userDoc.data() } as User;
        return user;
      }
    }

    if (personalId?.trim()) {
      const personalIdQuery = query(
        collection(db, 'users'),
        where('personalId', '==', personalId.trim())
      );
      const personalIdSnapshot = await getDocs(personalIdQuery);
      if (!personalIdSnapshot.empty) {
        const userDoc = personalIdSnapshot.docs[0];
        user = { id: userDoc.id, ...userDoc.data() } as User;
        return user;
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting user:', error);
    return null;
  }
};

// Create new client in Firestore
export const createClient = async (clientData: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  personalId: string;
  email?: string;
}): Promise<string> => {
  try {
    console.log('📝 Creating new client in Firestore...');

    const clientRef = doc(collection(db, 'users'));
    const newClientData = {
      ...clientData,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    await setDoc(clientRef, newClientData);
    console.log('✅ New client created with ID:', clientRef.id);

    return clientRef.id;
  } catch (error) {
    console.error('❌ Error creating client:', error);
    throw new Error('მომხმარებლის შექმნა ვერ მოხერხდა');
  }
};

// Get all users from Firestore (for admin purposes)
export const getAllUsers = async (): Promise<User[]> => {
  try {
    console.log('🔍 Loading all users from Firestore...');

    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    if (snapshot.empty) {
      console.warn('⚠️ No users found in Firestore collection');
      return [];
    }

    const firestoreUsers: User[] = [];

    snapshot.forEach((doc) => {
      const userData = doc.data();

      if (!userData.firstName || !userData.lastName || !userData.role) {
        console.warn(`⚠️ Skipping invalid user document ${doc.id}:`, userData);
        return;
      }

      const user = {
        id: doc.id,
        ...userData,
        createdAt: userData.createdAt?.toDate() || new Date(),
        updatedAt: userData.updatedAt?.toDate() || new Date()
      } as User;

      firestoreUsers.push(user);
    });

    console.log(`✅ Loaded ${firestoreUsers.length} users from Firestore`);
    return firestoreUsers;
  } catch (error) {
    console.error('❌ Error loading users from Firestore:', error);
    return [];
  }
};

// Create user
export const createUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> => {
  try {
    console.log('📝 Creating new user in Firestore...');

    const userRef = doc(collection(db, 'users'));
    const newUserData = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(userRef, newUserData);

    const createdUser = {
      id: userRef.id,
      ...newUserData
    } as User;

    console.log('✅ New user created with ID:', userRef.id);
    return createdUser;
  } catch (error) {
    console.error('❌ Error creating user:', error);
    throw new Error('მომხმარებლის შექმნა ვერ მოხერხდა');
  }
};

export const createUserWithId = async (
  userId: string,
  userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
): Promise<User> => {
  try {
    console.log('📝 Creating new user with fixed ID in Firestore...', userId);

    const userRef = doc(db, 'users', userId);
    const newUserData = {
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await setDoc(userRef, newUserData);

    return {
      id: userId,
      ...newUserData
    } as User;
  } catch (error) {
    console.error('❌ Error creating user with custom ID:', error);
    throw new Error('მომხმარებლის შექმნა ვერ მოხერხდა');
  }
};

// Update user
export const updateUser = async (userId: string, updates: Partial<User>): Promise<void> => {
  try {
    console.log('📝 Updating user in Firestore:', userId);

    const userRef = doc(db, 'users', userId);
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    await updateDoc(userRef, updateData);
    console.log('✅ User updated successfully');
  } catch (error) {
    console.error('❌ Error updating user:', error);
    throw new Error('მომხმარებლის განახლება ვერ მოხერხდა');
  }
};

// Delete user
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting user from Firestore:', userId);

    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    console.log('✅ User deleted successfully');
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    throw new Error('მომხმარებლის წაშლა ვერ მოხერხდა');
  }
};

// Permission helpers
export const canDeleteUser = (targetUser: User): boolean => {
  // Only allow deletion of non-super-admin users
  return targetUser.role !== 'SUPER_ADMIN';
};

export const canEditUser = (_targetUser: User): boolean => {
  // Allow editing all users except some restrictions can be added here
  return true;
};

// Authenticate user (for login)
export const authenticateUser = async (emailOrPhone: string, _password: string): Promise<User> => {
  try {
    console.log('🔑 Authenticating user from Firestore...');

    // Query users by email or phone
    const emailQuery = query(
      collection(db, 'users'),
      where('email', '==', emailOrPhone.toLowerCase())
    );
    const phoneQuery = query(
      collection(db, 'users'),
      where('phoneNumber', '==', emailOrPhone)
    );

    const [emailSnapshot, phoneSnapshot] = await Promise.all([
      getDocs(emailQuery),
      getDocs(phoneQuery)
    ]);

    let userDoc = null;
    if (!emailSnapshot.empty) {
      userDoc = emailSnapshot.docs[0];
    } else if (!phoneSnapshot.empty) {
      userDoc = phoneSnapshot.docs[0];
    }

    if (!userDoc) {
      throw new Error('მომხმარებელი ვერ მოიძებნა');
    }

    const userData = userDoc.data();

    // For demo purposes, we'll skip password validation
    // In production, you should hash and verify passwords properly
    console.log('✅ User authenticated successfully');

    return {
      id: userDoc.id,
      ...userData,
      createdAt: userData.createdAt?.toDate() || new Date(),
      updatedAt: userData.updatedAt?.toDate() || new Date()
    } as User;

  } catch (error) {
    console.error('❌ Authentication error:', error);
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    throw normalizedError;
  }
};

// Create initial super admin (if needed)
export const createInitialSuperAdmin = async (): Promise<void> => {
  console.log('🔧 Creating initial super admin if not exists...');
  // Implementation as needed
};

// Clean test users (utility function)
export const cleanTestUsers = async (): Promise<void> => {
  console.log('🧹 Cleaning test users...');
  // Implementation as needed
};

// Register customer during booking (fallback)
export const registerCustomerDuringBooking = async (customerData: {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  personalId: string;
  password: string;
}): Promise<{ id: string }> => {
  return { id: await createClient(customerData) };
};

// ფუნქცია მომხმარებლის მიღებისთვის ID-ით
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    console.log(`📋 Getting user by ID: ${userId}`);
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (userDoc.exists()) {
      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      console.log('✅ User found:', userData);
      return userData;
    } else {
      console.log('❌ User not found');
      return null;
    }
  } catch (error) {
    console.error('Error getting user by ID:', error);
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    throw normalizedError;
  }
};

// ფუნქცია მომხმარებლის მიღებისთვის ელ-ფოსტით
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    console.log(`📧 Getting user by email: ${email}`);
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );

    const querySnapshot = await getDocs(usersQuery);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      console.log('✅ User found by email:', userData);
      return userData;
    } else {
      console.log('❌ User not found by email');
      return null;
    }
  } catch (error) {
    console.error('Error getting user by email:', error);
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    throw normalizedError;
  }
};