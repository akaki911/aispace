
import { cleanTestUsers } from '../services/userService';

export const runTestDataCleanup = async () => {
  try {
    console.log('🚀 Starting comprehensive test data cleanup...');
    
    // Clean test users but keep legitimate ones
    await cleanTestUsers();
    
    console.log('✅ Test data cleanup completed successfully!');
    alert('✅ ტესტ მონაცემები წარმატებით წაიშალა! დარჩა მხოლოდ ორიგინალური ადმინისტრატორი.');
    
  } catch (error) {
    console.error('❌ Error during test data cleanup:', error);
    alert(`❌ შეცდომა ტესტ მონაცემების წაშლისას: ${error}`);
  }
};

// Run cleanup immediately when this file is imported
if (typeof window !== 'undefined') {
  // Only run in browser environment
  console.log('🔧 Test data cleanup utility loaded');
}
