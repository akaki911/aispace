import { getUserByEmail } from '../services/userService';

export const checkUserExistence = async (email: string, personalId: string) => {
  console.log(`🔍 Checking user existence for: ${email}, ${personalId}`);
  
  try {
    // შევამოწმოთ ელ-ფოსტით
    const userByEmail = await getUserByEmail(email);
    
    if (userByEmail) {
      console.log('✅ User found by email:', {
        id: userByEmail.id,
        email: userByEmail.email,
        personalId: userByEmail.personalId,
        firstName: userByEmail.firstName,
        lastName: userByEmail.lastName,
        role: userByEmail.role,
        isActive: userByEmail.isActive
      });
      return { exists: true, user: userByEmail, foundBy: 'email' };
    }
    
    console.log('❌ User not found by email or personalId');
    return { exists: false };
    
  } catch (error) {
    console.error('❌ Error checking user existence:', error);
    const message = error instanceof Error ? error.message : String(error);
    return { exists: false, error: message };
  }
};

// გამოყენების მაგალითი - Execute immediately
checkUserExistence('akaki.cincadze@gmail.com', '01019062020')
  .then(result => {
    console.log('🔍 User check result:', result);
    if (result.exists) {
      console.log('✅ მომხმარებელი არსებობს Firebase-ში!');
      console.log('📊 User data:', result.user);
    } else {
      console.log('❌ მომხმარებელი არ არსებობს Firebase-ში');
      console.log('💡 შეიძლება მხოლოდ ფაილების სისტემაში იყოს hard-coded');
    }
  })
  .catch(error => {
    console.error('🔥 შეცდომა მომხმარებლის შემოწმებისას:', error);
  });

// Make function available globally for testing
if (typeof window !== 'undefined') {
  (window as any).checkUserExistence = checkUserExistence;
  
  // Execute on load
  setTimeout(() => {
    checkUserExistence('akaki.cincadze@gmail.com', '01019062020');
  }, 1000);
}