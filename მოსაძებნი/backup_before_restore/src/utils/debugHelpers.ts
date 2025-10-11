import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const verifyFirebaseUser = async (userId: string) => {
  try {
    console.log('🔍 Checking Firebase user document for:', userId);

    // Check users collection
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('📊 Firebase user data:', userData);
      console.log('🆔 Firebase personalId:', userData.personalId);
      console.log('🎯 Target personalId: "01019062020"');
      console.log('✅ Match?', userData.personalId === "01019062020");
      return userData;
    }

    // Check customers collection
    const customerDocRef = doc(db, 'customers', userId);
    const customerDoc = await getDoc(customerDocRef);

    if (customerDoc.exists()) {
      const customerData = customerDoc.data();
      console.log('📊 Firebase customer data:', customerData);
      console.log('🆔 Firebase customer personalId:', customerData.personalId);
      console.log('🎯 Target personalId: "01019062020"');
      console.log('✅ Match?', customerData.personalId === "01019062020");
      return customerData;
    }

    console.log('❌ No user found in Firebase');
    return null;
  } catch (error) {
    console.error('❌ Error checking Firebase user:', error);
    return null;
  }
};

// Special function to check if AI Assistant should be visible for Akaki
export const shouldShowAIAssistant = (user: any): boolean => {
  // Multiple checks for extra security
  return !!(
    user && 
    user.personalId === "01019062020" &&
    (user.firstName === "აკაკი" || user.firstName === "Akaki") &&
    (user.lastName === "ცინცაძე" || user.lastName === "Tsintsadze")
  );
};

// Global debug functions for browser console
declare global {
  interface Window {
    debugAIUser: () => void;
    checkAIVisibility: () => void;
    checkFirebaseDirectly: (userId: string) => void;
    inspectLocalStorage: () => void;
  }
}

window.debugAIUser = async () => {
  try {
    const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
    console.log('🔍 localStorage authUser:', authUser);

    if (authUser.id) {
      await verifyFirebaseUser(authUser.id);
    }
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
};

window.checkAIVisibility = () => {
  const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
  console.log('🤖 AI Visibility Check:', {
    hasUser: !!authUser,
    userPersonalId: authUser.personalId,
    personalIdType: typeof authUser.personalId,
    personalIdLength: authUser.personalId?.length,
    targetPersonalId: "01019062020",
    exactMatch: authUser.personalId === "01019062020",
    shouldShowAI: authUser.personalId === "01019062020",
    userRole: authUser.role,
    userEmail: authUser.email,
    fullUserObject: authUser
  });

  // Check if AI Assistant elements exist in DOM
  const aiContainers = document.querySelectorAll('[style*="lime"], [style*="purple"]');
  const errorContainers = document.querySelectorAll('[style*="red"]');

  console.log('🤖 AI Assistant DOM elements found:', aiContainers.length);
  console.log('🔴 Error containers found:', errorContainers.length);

  aiContainers.forEach((el, index) => {
    console.log(`🤖 AI Container ${index}:`, el);
  });

  errorContainers.forEach((el, index) => {
    console.log(`🔴 Error Container ${index}:`, el, el.textContent);
  });

  // Check React component tree
  console.log('🔍 Checking React state...');
  const reactRoot = document.querySelector('#root');
  if (reactRoot) {
    console.log('📱 React root found, checking for Layout component...');
  }
};

window.checkFirebaseDirectly = async (userId: string) => {
  console.log('🔍 Direct Firebase check for user:', userId);
  const result = await verifyFirebaseUser(userId);
  console.log('🔍 Result:', result);
};

window.inspectLocalStorage = () => {
  const authUser = localStorage.getItem('authUser');
  console.log('📦 localStorage authUser raw:', authUser);
  if (authUser) {
    try {
      const parsed = JSON.parse(authUser);
      console.log('📦 localStorage authUser parsed:', parsed);
      console.log('📦 personalId type:', typeof parsed.personalId);
      console.log('📦 personalId value:', JSON.stringify(parsed.personalId));
      console.log('📦 personalId length:', parsed.personalId?.length);
      console.log('📦 personalId === "01019062020":', parsed.personalId === "01019062020");
      console.log('📦 role:', parsed.role);
      console.log('📦 email:', parsed.email);
      console.log('📦 Full object keys:', Object.keys(parsed));

      // Check for any undefined values
      Object.entries(parsed).forEach(([key, value]) => {
        if (value === undefined) {
          console.warn(`⚠️ ${key} is undefined`);
        }
      });
    } catch (e) {
      console.error('❌ Failed to parse localStorage authUser:', e);
    }
  } else {
    console.log('❌ No authUser in localStorage');
  }
};