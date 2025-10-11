
import { collection, doc, addDoc, updateDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface PriceOverrideToken {
  id: string;
  code: string;
  productType: 'cottage' | 'vehicle' | 'hotel';
  productId: string;
  createdBy: string;
  expiresAt: Timestamp;
  used: boolean;
  usedBy?: string;
  usedAt?: Timestamp;
  createdAt: Timestamp;
}

// Generate random 6-character code
const generateCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create new price override token
export const createPriceOverrideToken = async (
  productType: 'cottage' | 'vehicle' | 'hotel',
  productId: string,
  createdBy: string
): Promise<PriceOverrideToken> => {
  try {
    const code = generateCode();
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + (12 * 60 * 60 * 1000)); // 12 hours

    const tokenData = {
      code,
      productType,
      productId,
      createdBy,
      expiresAt,
      used: false,
      createdAt: now
    };

    console.log('🔐 Creating price override token:', { code, productType, productId, expiresAt: expiresAt.toDate() });

    const docRef = await addDoc(collection(db, 'priceOverrideTokens'), tokenData);
    
    const newToken: PriceOverrideToken = {
      id: docRef.id,
      ...tokenData
    };

    console.log('✅ Price override token created successfully:', newToken.code);
    return newToken;

  } catch (error: any) {
    console.error('❌ Error creating price override token:', error);
    throw new Error(`კოდის შექმნა ვერ მოხერხდა: ${error.message}`);
  }
};

// Validate price override token
export const validatePriceOverrideToken = async (
  code: string,
  productType: 'cottage' | 'vehicle' | 'hotel',
  productId: string
): Promise<{ valid: boolean; token?: PriceOverrideToken; error?: string }> => {
  try {
    console.log('🔍 Validating price override token:', { code, productType, productId });

    const tokensRef = collection(db, 'priceOverrideTokens');
    const q = query(
      tokensRef,
      where('code', '==', code.toUpperCase()),
      where('productType', '==', productType),
      where('productId', '==', productId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('❌ Token not found');
      return { valid: false, error: 'კოდი არ მოიძებნა' };
    }

    const tokenDoc = querySnapshot.docs[0];
    const token: PriceOverrideToken = {
      id: tokenDoc.id,
      ...tokenDoc.data()
    } as PriceOverrideToken;

    // Check if already used
    if (token.used) {
      console.log('❌ Token already used');
      return { valid: false, error: 'კოდი უკვე გამოყენებულია' };
    }

    // Check if expired
    const now = Timestamp.now();
    if (token.expiresAt.toMillis() < now.toMillis()) {
      console.log('❌ Token expired');
      return { valid: false, error: 'კოდის ვადა გასულია' };
    }

    console.log('✅ Token is valid');
    return { valid: true, token };

  } catch (error: any) {
    console.error('❌ Error validating token:', error);
    return { valid: false, error: 'კოდის შემოწმება ვერ მოხერხდა' };
  }
};

// Mark token as used
export const markTokenAsUsed = async (
  tokenId: string,
  usedBy: string
): Promise<void> => {
  try {
    console.log('🔒 Marking token as used:', { tokenId, usedBy });

    const tokenRef = doc(db, 'priceOverrideTokens', tokenId);
    await updateDoc(tokenRef, {
      used: true,
      usedBy,
      usedAt: Timestamp.now()
    });

    console.log('✅ Token marked as used successfully');

  } catch (error: any) {
    console.error('❌ Error marking token as used:', error);
    throw new Error(`კოდის გამოყენების ფიქსირება ვერ მოხერხდა: ${error.message}`);
  }
};

// Get tokens created by user
export const getTokensByCreator = async (createdBy: string): Promise<PriceOverrideToken[]> => {
  try {
    const tokensRef = collection(db, 'priceOverrideTokens');
    const q = query(tokensRef, where('createdBy', '==', createdBy));
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as PriceOverrideToken[];

  } catch (error: any) {
    console.error('❌ Error fetching tokens:', error);
    return [];
  }
};
