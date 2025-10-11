import { createUser, deleteUser, getAllUsers } from '../services/userService';

export const resetMyUser = async () => {
  try {
    console.log('🔄 Starting user reset process...');

    // Get all users first
    const allUsers = await getAllUsers();
    console.log('📋 All users:', allUsers);

    // Find user with personalId "01019062020"
    const targetUser = allUsers.find(user => user.personalId === "01019062020");

    if (targetUser) {
      console.log('🎯 Found target user:', targetUser);
      console.log('🗑️ Deleting existing user...');

      try {
        await deleteUser(targetUser.id);
        console.log('✅ User deleted successfully');
      } catch (deleteError) {
        console.warn('⚠️ Delete error (continuing):', deleteError);
      }
    } else {
      console.log('❌ No user found with personalId "01019062020"');
    }

    // Create new user based on Firebase data
    console.log('🔄 Creating new user...');
    const newUser = await createUser({
      email: 'akaki@bakhmaro.co',
      firstName: 'აკაკი',
      lastName: 'ცინცაძე',
      role: 'SUPER_ADMIN',
      phoneNumber: '577241517',
      personalId: '01019062020',
      password: 'SuperAdmin2024!',
      isActive: true,
      address: 'ბახმარო',
      notes: 'სუპერ ადმინისტრატორი - სისტემის მთავარი მმართველი'
    });

    console.log('✅ New user created:', newUser);

    return {
      success: true,
      message: 'მომხმარებელი წარმატებით გადაყენდა',
      user: newUser
    };

  } catch (error) {
    console.error('❌ Error resetting user:', error);
    return {
      success: false,
      message: `შეცდომა: ${error instanceof Error ? error.message : String(error)}`,
      error
    };
  }
};