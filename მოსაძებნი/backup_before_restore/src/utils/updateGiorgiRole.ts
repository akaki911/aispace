
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const updateGiorgiRole = async () => {
  try {
    // გიორგის ID-ს უნდა ჩავასწოროთ რეალური ID-თი
    const giorgiUserId = 'GIORGI_USER_ID'; // ეს უნდა ჩავანაცვლოთ რეალური ID-თი
    
    // ჯერ შევამოწმოთ რა როლი აქვს ახლა
    const userRef = doc(db, 'users', giorgiUserId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      console.log('🔍 გიორგის ამჟამინდელი მონაცემები:', userSnap.data());
      
      await updateDoc(userRef, {
        role: 'PROVIDER_ADMIN',
        updatedAt: new Date().toISOString(),
        isActive: true,
        agreedToTerms: true
      });
      
      console.log('✅ გიორგის როლი განახლდა PROVIDER_ADMIN-ზე');
    } else {
      console.error('❌ გიორგი ვერ მოიძებნა ბაზაში');
    }
  } catch (error) {
    console.error('❌ შეცდომა გიორგის როლის განახლებისას:', error);
    throw error;
  }
};

// ფუნქციის გამოძახება (ეს ხაზი შეგვიძლია მოვშალოთ პროდუქციაში)
// updateGiorgiRole();
