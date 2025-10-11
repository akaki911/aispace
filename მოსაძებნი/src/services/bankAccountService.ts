
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { BankAccount } from '../types/bank';

export const bankAccountService = {
  // ყველა ბანკის ანგარიშის მიღება
  async getAllBankAccounts(): Promise<BankAccount[]> {
    try {
      console.log('🏦 Fetching bank accounts from Firestore...');

      const snapshot = await getDocs(collection(db, 'bankAccounts'));
      const accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as BankAccount;
      });

      console.log(`🏦 Successfully loaded ${accounts.length} bank accounts`);
      return accounts;
    } catch (error) {
      console.error('❌ Error fetching bank accounts:', error);
      const message = error instanceof Error ? error.message : 'უცნობი შეცდომა';
      throw new Error(`ბანკის ანგარიშების ჩატვირთვის შეცდომა: ${message}`);
    }
  },

  // პროვაიდერის ბანკის ანგარიშების მიღება
  async getProviderBankAccounts(providerId: string): Promise<BankAccount[]> {
    try {
      const q = query(
        collection(db, 'bankAccounts'), 
        where('providerId', '==', providerId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as BankAccount[];
    } catch (error) {
      console.error('Error fetching provider bank accounts:', error);
      throw error;
    }
  },

  // გაზიარებული ანგარიშების მიღება (მხოლოდ ამ პროვაიდერისთვის)
  async getSharedBankAccounts(providerId?: string): Promise<BankAccount[]> {
    try {
      console.log('🏦 Fetching shared bank accounts from Firestore...');
      
      if (!providerId) {
        console.log('❌ Provider ID is required for shared accounts');
        return [];
      }
      
      const q = query(
        collection(db, 'bankAccounts'), 
        where('accountType', '==', 'shared'),
        where('providerId', '==', providerId)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('🏦 No shared bank accounts found for this provider');
        return [];
      }
      
      const accounts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as BankAccount;
      });
      
      console.log(`🏦 Successfully loaded ${accounts.length} shared bank accounts for provider: ${providerId}`);
      
      // Filter active accounts and sort in memory
      const activeAccounts = accounts
        .filter(account => account.isActive !== false)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
      console.log(`🏦 Active shared accounts: ${activeAccounts.length}`);
      return activeAccounts;
    } catch (error) {
      console.error('❌ Error fetching shared bank accounts:', error);
      // Return empty array instead of throwing to prevent crashes
      return [];
    }
  },

  // ახალი ბანკის ანგარიშის დამატება
  async addBankAccount(accountData: Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'bankAccounts'), {
        ...accountData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding bank account:', error);
      throw error;
    }
  },

  // ბანკის ანგარიშის განახლება
  async updateBankAccount(id: string, updates: Partial<BankAccount>): Promise<void> {
    try {
      const accountRef = doc(db, 'bankAccounts', id);
      await updateDoc(accountRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating bank account:', error);
      throw error;
    }
  },

  // ბანკის ანგარიშის წაშლა
  async deleteBankAccount(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'bankAccounts', id));
    } catch (error) {
      console.error('Error deleting bank account:', error);
      throw error;
    }
  },

  // ბანკის ანგარიშის დეაქტივაცია
  async deactivateBankAccount(id: string): Promise<void> {
    try {
      const accountRef = doc(db, 'bankAccounts', id);
      await updateDoc(accountRef, {
        isActive: false,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error deactivating bank account:', error);
      throw error;
    }
  },

  // კონკრეტული ბანკის ანგარიშის მიღება ID-ით
  async getBankAccountById(id: string): Promise<BankAccount | null> {
    try {
      const docRef = doc(db, 'bankAccounts', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: docSnap.data().updatedAt?.toDate() || new Date()
        } as BankAccount;
      }
      return null;
    } catch (error) {
      console.error('Error fetching bank account by ID:', error);
      throw error;
    }
  },

  // კოტეჯებზე მიბმული ანგარიშების მიღება
  async getCottagesBankAccounts(cottageIds: string[]): Promise<{ [cottageId: string]: BankAccount }> {
    try {
      const cottagesBankAccounts: { [cottageId: string]: BankAccount } = {};
      
      for (const cottageId of cottageIds) {
        // ჯერ დავამოწმოთ კოტეჯის მონაცემები
        const cottageRef = doc(db, 'cottages', cottageId);
        const cottageSnap = await getDoc(cottageRef);
        
        if (cottageSnap.exists()) {
          const cottageData = cottageSnap.data();
          if (cottageData.bankAccountId) {
            // აქვს მიბმული ანგარიშის ID
            const bankAccount = await this.getBankAccountById(cottageData.bankAccountId);
            if (bankAccount) {
              cottagesBankAccounts[cottageId] = bankAccount;
            }
          } else if (cottageData.bankAccount) {
            // ძველი ფორმატი - პირდაპირ შენახული ინფორმაცია
            cottagesBankAccounts[cottageId] = {
              id: `legacy_${cottageId}`,
              bank: cottageData.bankAccount.bank || '',
              accountNumber: cottageData.bankAccount.accountNumber || '',
              accountHolderName: cottageData.bankAccount.accountHolderName || '',
              accountType: 'personal',
              providerId: cottageData.providerId || '',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
          }
        }
      }
      
      return cottagesBankAccounts;
    } catch (error) {
      console.error('Error fetching cottages bank accounts:', error);
      throw error;
    }
  },

  // ანგარიშის გაზიარება (accountType = 'shared'-ზე შეცვლა)
  async shareBankAccount(accountId: string): Promise<void> {
    try {
      await this.updateBankAccount(accountId, {
        accountType: 'shared'
      });
    } catch (error) {
      console.error('Error sharing bank account:', error);
      throw error;
    }
  },

  // მიბმული კოტეჯების რაოდენობის შემოწმება
  async getLinkedCottagesCount(accountId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'cottages'),
        where('bankAccountId', '==', accountId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting linked cottages count:', error);
      return 0;
    }
  }
};
