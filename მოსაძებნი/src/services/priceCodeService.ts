
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface PriceCode {
  id?: string;
  code: string;
  resourceId: string;
  resourceType: 'cottage' | 'hotel' | 'vehicle';
  isUsed: boolean;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  usedAt?: Timestamp;
}

// Generate a random 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create a new price code
export async function createPriceCode(
  resourceId: string, 
  resourceType: 'cottage' | 'hotel' | 'vehicle'
): Promise<string> {
  try {
    const code = generateCode(); // This generates a string
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours from now

    const priceCodeData = {
      code: code.toString(), // Ensure it's stored as string
      resourceId: resourceId.toString(), // Ensure resourceId is string
      resourceType,
      isUsed: false,
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expiresAt)
    };

    console.log('Creating price code with data:', priceCodeData);
    await addDoc(collection(db, 'priceCodes'), priceCodeData);
    console.log('Price code created successfully:', code);
    return code;
  } catch (error) {
    console.error('Error creating price code:', error);
    throw new Error('ფასის კოდის შექმნისას მოხდა შეცდომა');
  }
}

// Validate and use a price code - optimized query approach
export async function validatePriceCode(code: string, cottageId: string): Promise<{
  isValid: boolean;
  resourceId?: string;
  resourceType?: 'cottage' | 'hotel' | 'vehicle';
  error?: string;
}> {
  try {
    console.log('Validating price code:', code, 'for cottage:', cottageId);
    
    if (!code || code.trim().length !== 6) {
      return {
        isValid: false,
        error: 'კოდი უნდა იყოს 6 ციფრისგან შემდგარი'
      };
    }

    // First, get all codes with the specific code value (simpler query)
    const codeQuery = query(
      collection(db, 'priceCodes'),
      where('code', '==', code.trim())
    );

    const codeSnapshot = await getDocs(codeQuery);
    
    if (codeSnapshot.empty) {
      console.log('No price code found with code:', code);
      return {
        isValid: false,
        error: 'არასწორი კოდი'
      };
    }

    // Filter results in JavaScript to avoid complex composite index
    const now = Timestamp.now();
    const validCodes = codeSnapshot.docs.filter(doc => {
      const data = doc.data() as PriceCode;
      return (
        data.resourceId === cottageId &&
        data.isUsed === false &&
        data.expiresAt.toMillis() > now.toMillis()
      );
    });

    if (validCodes.length === 0) {
      console.log('No valid price code found for cottage:', cottageId);
      return {
        isValid: false,
        error: 'კოდი არ მოიძებნა ან ვადა გასულია'
      };
    }

    const priceCodeDoc = validCodes[0];
    const priceCodeData = priceCodeDoc.data() as PriceCode;
    
    console.log('Found valid price code:', priceCodeData);

    // Mark as used
    await updateDoc(doc(db, 'priceCodes', priceCodeDoc.id), {
      isUsed: true,
      usedAt: serverTimestamp()
    });

    console.log('Price code validated and marked as used successfully');
    return {
      isValid: true,
      resourceId: priceCodeData.resourceId,
      resourceType: priceCodeData.resourceType
    };

  } catch (error) {
    console.error('Error validating price code:', error);
    return {
      isValid: false,
      error: 'კოდის ვალიდაციისას მოხდა შეცდომა'
    };
  }
}

// Get all price codes for a resource (admin only)
export async function getPriceCodesForResource(
  resourceId: string,
  resourceType: 'cottage' | 'hotel' | 'vehicle'
): Promise<PriceCode[]> {
  try {
    const q = query(
      collection(db, 'priceCodes'),
      where('resourceId', '==', resourceId),
      where('resourceType', '==', resourceType)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PriceCode));
  } catch (error) {
    console.error('Error fetching price codes:', error);
    return [];
  }
}
