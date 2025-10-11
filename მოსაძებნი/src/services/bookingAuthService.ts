
import { auth, db } from '../firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  PhoneAuthProvider,
  RecaptchaVerifier
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';

export interface BookingUser {
  uid: string;
  email: string;
  phoneNumber: string;
  personalId: string;
  firstName: string;
  lastName: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'SUPER_ADMIN';
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface RegistrationData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  personalId: string;
  email: string;
  password: string;
}

class BookingAuthService {
  
  /**
   * Register a new user through booking form
   */
  async registerUser(data: RegistrationData): Promise<BookingUser> {
    try {
      console.log('🔐 Starting user registration...');

      // Check if user already exists
      const existingUser = await this.checkUserExists(data.email, data.phoneNumber, data.personalId);
      if (existingUser) {
        throw new Error('მომხმარებელი ამ მონაცემებით უკვე არსებობს');
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      // Create comprehensive user document
      const userData: Partial<BookingUser> = {
        uid: firebaseUser.uid,
        email: data.email,
        phoneNumber: data.phoneNumber,
        personalId: data.personalId,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'CUSTOMER',
        isActive: true,
        emailVerified: firebaseUser.emailVerified,
        phoneVerified: false,
        createdAt: new Date(),
        lastLoginAt: new Date()
      };

      // Save to Firestore
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        ...userData,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        preferences: {
          notifications: {
            email: true,
            sms: true,
            push: false
          },
          language: 'ka',
          theme: 'light'
        },
        stats: {
          totalBookings: 0,
          cancelledBookings: 0,
          completedBookings: 0
        },
        registrationSource: 'booking_form'
      });

      // Send email verification
      await sendEmailVerification(firebaseUser);

      console.log('✅ User registered successfully:', firebaseUser.uid);
      return userData as BookingUser;

    } catch (error: any) {
      console.error('❌ Registration error:', error);
      throw new Error(this.getErrorMessage(error.code || error.message));
    }
  }

  /**
   * Login user with phone number and password
   */
  async loginWithPhone(phoneNumber: string, password: string): Promise<BookingUser> {
    try {
      console.log('🔐 Attempting login with phone...');

      // Find user by phone number
      const userQuery = query(
        collection(db, 'users'),
        where('phoneNumber', '==', phoneNumber.trim())
      );
      
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        throw new Error('მომხმარებელი ამ ტელეფონის ნომრით ვერ მოიძებნა');
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data() as BookingUser;

      // Login with email
      const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);

      // Update last login time
      await updateDoc(doc(db, 'users', userCredential.user.uid), {
        lastLoginAt: serverTimestamp()
      });

      console.log('✅ Phone login successful:', userCredential.user.uid);
      return userData;

    } catch (error: any) {
      console.error('❌ Phone login error:', error);
      throw new Error(this.getErrorMessage(error.code || error.message));
    }
  }

  /**
   * Check if user exists by email, phone, or personal ID
   */
  async checkUserExists(email?: string, phoneNumber?: string, personalId?: string): Promise<BookingUser | null> {
    try {
      const queries = [];

      if (email) {
        queries.push(query(collection(db, 'users'), where('email', '==', email.toLowerCase())));
      }
      
      if (phoneNumber) {
        queries.push(query(collection(db, 'users'), where('phoneNumber', '==', phoneNumber.trim())));
      }
      
      if (personalId) {
        queries.push(query(collection(db, 'users'), where('personalId', '==', personalId.trim())));
      }

      const results = await Promise.all(queries.map(q => getDocs(q)));
      
      for (const snapshot of results) {
        if (!snapshot.empty) {
          return snapshot.docs[0].data() as BookingUser;
        }
      }

      return null;

    } catch (error) {
      console.error('❌ Error checking user existence:', error);
      return null;
    }
  }

  /**
   * Get user by UID
   */
  async getUserById(uid: string): Promise<BookingUser | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        return userDoc.data() as BookingUser;
      }
      
      return null;

    } catch (error) {
      console.error('❌ Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * Initialize phone verification
   */
  async initPhoneVerification(phoneNumber: string): Promise<string> {
    try {
      // Initialize RecaptchaVerifier
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log('✅ reCAPTCHA verified');
        }
      });

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(phoneNumber, recaptchaVerifier);

      console.log('✅ SMS sent for verification');
      return verificationId;

    } catch (error: any) {
      console.error('❌ Phone verification error:', error);
      throw new Error('SMS კოდის გაგზავნა ვერ მოხერხდა');
    }
  }

  /**
   * Get user-friendly error messages
   */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'მომხმარებელი ვერ მოიძებნა';
      case 'auth/wrong-password':
        return 'არასწორი პაროლი';
      case 'auth/email-already-in-use':
        return 'ეს ელ-ფოსტა უკვე გამოიყენება';
      case 'auth/weak-password':
        return 'ძალიან სუსტი პაროლი (მინიმუმ 6 სიმბოლო)';
      case 'auth/invalid-email':
        return 'არასწორი ელ-ფოსტის ფორმატი';
      case 'auth/too-many-requests':
        return 'ძალიან ბევრი მცდელობა. სცადეთ მოგვიანებით';
      case 'auth/network-request-failed':
        return 'ქსელის შეცდომა. შეამოწმეთ ინტერნეტ კავშირი';
      case 'auth/invalid-phone-number':
        return 'არასწორი ტელეფონის ნომერი';
      case 'auth/quota-exceeded':
        return 'SMS კვოტა ამოიწურა. სცადეთ მოგვიანებით';
      default:
        return errorCode.includes('მომხმარებელი') ? errorCode : 'ავტორიზაციის შეცდომა';
    }
  }
}

export const bookingAuthService = new BookingAuthService();
