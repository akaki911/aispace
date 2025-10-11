
export enum GeorgianBank {
  TBC = 'თიბისი (TBC)',
  BOG = 'საქართველოს ბანკი (Bank of Georgia)',
  LIBERTY = 'ლიბერთი ბანკი',
  TSS = 'თსს ბანკი',
  CREDO = 'კრედო ბანკი',
  BASIS = 'ბაზისბანკი',
  CITY = 'სითი ბანკი',
  OTHER = 'სხვა ბანკი'
}

export interface BankAccountInfo {
  bank: GeorgianBank | string;
  accountNumber: string;
  accountHolderName: string;
  accountType?: 'individual' | 'shared';
  customBankName?: string;
}

export interface BankAccount {
  id: string;
  bank: string;
  accountNumber: string;
  accountHolderName: string;
  accountType: 'shared' | 'personal';
  providerId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  linkedCottages?: string[];
}

export interface CottageBankAccount {
  cottageId: string;
  cottageName: string;
  bankAccountId?: string;
  bankAccount?: BankAccountInfo;
}
