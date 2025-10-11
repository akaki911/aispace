
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { bankAccountService } from './bankAccountService';

export interface InvoiceBankAccount {
  bank: string;
  accountNumber: string;
  accountHolderName: string;
}

export const invoiceService = {
  // კოტეჯის ბანკის ანგარიშის მიღება ინვოისისთვის
  async getCottageBankAccount(cottageId: string): Promise<InvoiceBankAccount | null> {
    try {
      const cottageRef = doc(db, 'cottages', cottageId);
      const cottageSnap = await getDoc(cottageRef);

      if (!cottageSnap.exists()) {
        throw new Error('კოტეჯი არ მოიძებნა');
      }

      const cottageData = cottageSnap.data();
      
      // ჯერ ვამოწმებთ გაზიარებულ ანგარიშს
      if (cottageData.sharedBankAccountId) {
        const bankAccount = await bankAccountService.getBankAccountById(cottageData.sharedBankAccountId);
        if (bankAccount) {
          return {
            bank: bankAccount.bank,
            accountNumber: bankAccount.accountNumber,
            accountHolderName: bankAccount.accountHolderName
          };
        }
      }

      // ინდივიდუალური ანგარიშის შემოწმება
      if (cottageData.individualBankAccount) {
        return {
          bank: cottageData.individualBankAccount.bank || '',
          accountNumber: cottageData.individualBankAccount.accountNumber || '',
          accountHolderName: cottageData.individualBankAccount.accountHolderName || ''
        };
      }

      // ძველი ფორმატის შემოწმება (bankAccount object)
      if (cottageData.bankAccount) {
        return {
          bank: cottageData.bankAccount.bank || '',
          accountNumber: cottageData.bankAccount.accountNumber || '',
          accountHolderName: cottageData.bankAccount.accountHolderName || ''
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching cottage bank account:', error);
      throw error;
    }
  },

  // ჯავშნისთვის ბანკის ანგარიშის მიღება
  async getBookingBankAccount(bookingId: string): Promise<InvoiceBankAccount | null> {
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);

      if (!bookingSnap.exists()) {
        throw new Error('ჯავშანი არ მოიძებნა');
      }

      const bookingData = bookingSnap.data();
      const cottageId = bookingData.cottage;

      if (!cottageId) {
        throw new Error('კოტეჯის ID არ მოიძებნა ჯავშანში');
      }

      return await this.getCottageBankAccount(cottageId);
    } catch (error) {
      console.error('Error fetching booking bank account:', error);
      throw error;
    }
  }
};
