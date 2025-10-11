
// Debug test utilities for development environment
import { verifyFirebaseUser } from './debugHelpers';

export const runDebugTests = async () => {
  console.log('🔧 Starting Debug Console Tests...');
  
  try {
    // Check if we're in development mode
    if (import.meta.env.DEV) {
      console.log('✅ Development mode detected');
      
      // Test localStorage inspection
      inspectLocalStorage();
      
      // Test AI visibility check
      checkAIVisibility();
      
      // Schedule additional tests
      console.log('🔧 All tests scheduled to run in next 3 seconds');
      
      setTimeout(() => {
        console.log('🔧 Debug tests completed');
      }, 3000);
    }
  } catch (error) {
    console.error('❌ Debug test error:', error);
  }
};

export const inspectLocalStorage = () => {
  console.log('🔧 Inspecting localStorage...');
  console.log('📦 LocalStorage contents:');
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      console.log(`  ${key}:`, value);
    }
  }
};

export const checkAIVisibility = () => {
  console.log('🔧 Checking AI visibility...');
  
  try {
    const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
    const hasUser = !!authUser && !!authUser.id;
    const shouldShowAI = hasUser && authUser.personalId === "01019062020";
    
    console.log('🤖 AI Visibility Check:', {
      hasUser,
      shouldShowAI
    });
    
    return { hasUser, shouldShowAI };
  } catch (error) {
    console.error('❌ AI visibility check error:', error);
    return { hasUser: false, shouldShowAI: false };
  }
};

// Global debug function for browser console
declare global {
  interface Window {
    runDebugTests: () => Promise<void>;
    inspectLocalStorage: () => void;
    checkAIVisibility: () => { hasUser: boolean; shouldShowAI: boolean };
  }
}

// Expose functions globally for browser console access
if (typeof window !== 'undefined') {
  window.runDebugTests = runDebugTests;
  window.inspectLocalStorage = inspectLocalStorage;
  window.checkAIVisibility = checkAIVisibility;
}

// Auto-run debug tests in development
if (import.meta.env.DEV) {
  setTimeout(() => {
    runDebugTests();
  }, 1000);
}
