
import { collection, doc, addDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface TemporaryBlock {
  id: string;
  cottageId: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  expiresAt: Date;
  bookingId?: string;
  customerName: string;
  customerPhone: string;
}

// 15 წუთიანი ბლოკის შექმნა
export const createTemporaryBlock = async (
  cottageId: string,
  startDate: Date,
  endDate: Date,
  customerName: string,
  customerPhone: string,
  bookingId?: string
): Promise<TemporaryBlock> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 წუთი

  const blockData = {
    cottageId,
    startDate,
    endDate,
    createdAt: now,
    expiresAt,
    bookingId,
    customerName,
    customerPhone
  };

  const docRef = await addDoc(collection(db, 'temporaryBlocks'), blockData);

  // ავტომატური წაშლა 15 წუთში
  setTimeout(async () => {
    await removeExpiredBlock(docRef.id);
  }, 15 * 60 * 1000);

  return {
    id: docRef.id,
    ...blockData
  };
};

// ვადაგასული ბლოკის წაშლა
export const removeExpiredBlock = async (blockId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'temporaryBlocks', blockId));
    console.log('🗑️ Expired temporary block removed:', blockId);
  } catch (error) {
    console.error('❌ Error removing expired block:', error);
  }
};

// კოტეჯის დროებითი ბლოკების მიღება
export const getTemporaryBlocks = async (cottageId: string): Promise<TemporaryBlock[]> => {
  try {
    const q = query(
      collection(db, 'temporaryBlocks'),
      where('cottageId', '==', cottageId)
    );
    
    const snapshot = await getDocs(q);
    const blocks: TemporaryBlock[] = [];
    const now = new Date();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const expiresAt = data.expiresAt.toDate();

      // თუ ვადა გავიდა, წაშალე
      if (expiresAt <= now) {
        await removeExpiredBlock(doc.id);
        continue;
      }

      blocks.push({
        id: doc.id,
        cottageId: data.cottageId,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        createdAt: data.createdAt.toDate(),
        expiresAt: expiresAt,
        bookingId: data.bookingId,
        customerName: data.customerName,
        customerPhone: data.customerPhone
      });
    }

    return blocks;
  } catch (error) {
    console.error('❌ Error fetching temporary blocks:', error);
    return [];
  }
};

// ბლოკის მანუალური წაშლა (როცა გადახდა ხდება)
export const removeTemporaryBlock = async (blockId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'temporaryBlocks', blockId));
    console.log('✅ Temporary block removed successfully:', blockId);
  } catch (error) {
    console.error('❌ Error removing temporary block:', error);
  }
};

// თარიღის დროებითი ბლოკის შემოწმება
export const isDateTemporarilyBlocked = (
  date: Date,
  temporaryBlocks: TemporaryBlock[]
): boolean => {
  return temporaryBlocks.some(block => {
    const blockStart = new Date(block.startDate);
    const blockEnd = new Date(block.endDate);
    
    return date >= blockStart && date < blockEnd;
  });
};

// დარჩენილი დროის გამოთვლა
export const getRemainingTime = (expiresAt: Date): string => {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  
  if (diff <= 0) return '00:00';
  
  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
