
import { createUserWithId, getUserByEmail } from '../services/userService';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export const createSuperAdmin = async () => {
  const adminData = {
    email: 'akaki.cincadze@gmail.com',
    firstName: 'აკაკი',
    lastName: 'ცინცაძე',
    role: 'SUPER_ADMIN' as const,
    phoneNumber: '577241517',
    personalId: '01019062020',
    password: '2Akakiviinaadzea3@',
    isActive: true,
    address: 'ბახმარო',
    notes: 'სუპერ ადმინისტრატორი - სისტემის მთავარი მმართველი',
    agreedToTerms: true,
    termsAgreedAt: new Date(),
    registrationStatus: 'active' as const
  };

  try {
    console.log('🔄 Creating Super Admin...');

    // პირველ რიგში შევამოწმოთ არსებობს თუ არა უკვე
    const existingUser = await getUserByEmail(adminData.email);
    if (existingUser) {
      console.log('⚠️ User already exists:', existingUser);
      return { success: false, message: 'მომხმარებელი უკვე არსებობს', user: existingUser };
    }

    // შევქმნათ Firebase Auth user
    console.log('🔐 Creating Firebase Auth user...');
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      adminData.email, 
      adminData.password
    );

    console.log('✅ Firebase Auth user created:', userCredential.user.uid);

    // შევქმნათ Firestore user document
    console.log('📝 Creating Firestore user document...');
    const { password, ...userDataForFirestore } = adminData;
    
    const createdUser = await createUserWithId(
      userCredential.user.uid,
      userDataForFirestore
    );

    console.log('✅ Super Admin created successfully:', {
      id: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      firstName: createdUser.firstName,
      lastName: createdUser.lastName
    });

    return { 
      success: true, 
      message: 'სუპერ ადმინი წარმატებით შეიქმნა', 
      user: createdUser 
    };

  } catch (error: any) {
    console.error('❌ Error creating Super Admin:', error);
    
    let errorMessage = 'სუპერ ადმინის შექმნა ვერ მოხერხდა';
    
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'ეს ელ-ფოსტა უკვე გამოყენებულია';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'პაროლი ზედმეტად სუსტია';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'არასწორი ელ-ფოსტის ფორმატი';
    }

    return { success: false, message: errorMessage, error: error.message };
  }
};

// Make function available globally for testing
if (typeof window !== 'undefined') {
  (window as any).createSuperAdmin = createSuperAdmin;
  
  // Execute on load
  setTimeout(() => {
    console.log('🎯 Ready to create Super Admin. Use: createSuperAdmin()');
  }, 1000);
}
