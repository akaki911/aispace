import React, { useState, useEffect } from 'react';
import { bankAccountService } from '../services/bankAccountService';
import { BankAccount } from '../types/bank';
import { validateIBAN } from '../utils/validation';
import { useAuth } from '../contexts/useAuth';
import { Plus, Building, CreditCard, Users, Check, ChevronDown, Info, Share2 } from 'lucide-react';

const banks = [
  { id: 'tbc', name: 'თიბისი (TBC)', code: 'TBC' },
  { id: 'bog', name: 'საქართველოს ბანკი (Bank of Georgia)', code: 'BOG' },
  { id: 'liberty', name: 'ლიბერთი ბანკი', code: 'LIBERTY' },
  { id: 'tss', name: 'თსს ბანკი', code: 'TSS' },
  { id: 'credo', name: 'კრედო ბანკი', code: 'CREDO' },
  { id: 'basis', name: 'ბაზისბანკი', code: 'BASIS' },
  { id: 'city', name: 'სითი ბანკი', code: 'CITY' },
  { id: 'other', name: 'სხვა ბანკი', code: 'OTHER' }
];

interface BankAccountFieldProps {
  value?: {
    bank: string;
    accountNumber: string;
    accountHolderName: string;
    sharedBankAccountId?: string;
  };
  onChange: (value: { 
    bank: string; 
    accountNumber: string; 
    accountHolderName: string; 
    sharedBankAccountId?: string;
  } | undefined) => void;
  required?: boolean;
}

const BankAccountField: React.FC<BankAccountFieldProps> = ({ 
  value, 
  onChange, 
  required = false
}) => {
  const { user } = useAuth();
  const [accountType, setAccountType] = useState<'shared' | 'individual'>('shared');
  const [sharedAccounts, setSharedAccounts] = useState<BankAccount[]>([]);
  const [selectedSharedAccountId, setSelectedSharedAccountId] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // ინდივიდუალური ანგარიშის ფორმის მონაცემები
  const [individualAccountData, setIndividualAccountData] = useState({
    bank: '',
    accountNumber: '',
    accountHolderName: ''
  });

  useEffect(() => {
    const loadSharedAccounts = async () => {
      if (!user?.uid) return;

      try {
        setLoading(true);

        // გაზიარებული ანგარიშების ჩატვირთვა
        const shared = await bankAccountService.getSharedBankAccounts(user?.uid);
        setSharedAccounts(shared);

        // თუ არსებობს value და მისი sharedBankAccountId
        if (value?.sharedBankAccountId) {
          const existingAccount = shared.find(acc => acc.id === value.sharedBankAccountId);
          if (existingAccount) {
            setSelectedSharedAccountId(existingAccount.id);
            setAccountType('shared');
          }
        } else if (value && !value.sharedBankAccountId) {
          // ინდივიდუალური ანგარიში
          setAccountType('individual');
          setIndividualAccountData({
            bank: value.bank,
            accountNumber: value.accountNumber,
            accountHolderName: value.accountHolderName
          });
        }
      } catch (error) {
        console.error('Error loading shared accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSharedAccounts();
  }, [user?.uid, value?.sharedBankAccountId]);

  const handleAccountTypeChange = (type: 'shared' | 'individual') => {
    setAccountType(type);

    if (type === 'shared') {
      // გაზიარებული ანგარიშის არჩევა
      if (selectedSharedAccountId) {
        const account = sharedAccounts.find(acc => acc.id === selectedSharedAccountId);
        if (account) {
          onChange({
            bank: account.bank,
            accountNumber: account.accountNumber,
            accountHolderName: account.accountHolderName,
            sharedBankAccountId: account.id
          });
        }
      } else {
        onChange(undefined);
      }
    } else {
      // ინდივიდუალური ანგარიშის ფორმა
      setSelectedSharedAccountId('');
      if (individualAccountData.bank && individualAccountData.accountNumber && individualAccountData.accountHolderName) {
        onChange({
          bank: individualAccountData.bank,
          accountNumber: individualAccountData.accountNumber,
          accountHolderName: individualAccountData.accountHolderName
        });
      } else {
        onChange(undefined);
      }
    }
  };

  const handleSharedAccountSelect = (accountId: string) => {
    setSelectedSharedAccountId(accountId);
    const account = sharedAccounts.find(acc => acc.id === accountId);
    if (account) {
      onChange({
        bank: account.bank,
        accountNumber: account.accountNumber,
        accountHolderName: account.accountHolderName,
        sharedBankAccountId: account.id
      });
    }
  };

  const handleIndividualAccountChange = (field: string, newValue: string) => {
    const updatedData = { ...individualAccountData, [field]: newValue };
    setIndividualAccountData(updatedData);

    // Real-time validation for IBAN
    if (field === 'accountNumber' && newValue.trim()) {
      const validation = validateIBAN(newValue);
      setValidationError(validation.isValid ? '' : validation.message);
    }

    // Update parent component
    if (updatedData.bank && updatedData.accountNumber && updatedData.accountHolderName) {
      onChange({
        bank: updatedData.bank,
        accountNumber: updatedData.accountNumber,
        accountHolderName: updatedData.accountHolderName
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-8">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 dark:bg-gray-600 h-12 w-12"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <h4 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center">
          <CreditCard className="w-6 h-6 mr-3" />
          ბანკის ანგარიშის არჩევა
          {required && <span className="text-red-500 ml-1">*</span>}
        </h4>

        {/* Account Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => handleAccountTypeChange('shared')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              accountType === 'shared'
                ? 'border-green-500 bg-green-50 dark:bg-green-900 dark:bg-opacity-20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <Share2 className="w-5 h-5 mr-2 text-green-600" />
              <span className="font-semibold text-gray-900 dark:text-white">
                გაზიარებული ანგარიში
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              აირჩიეთ უკვე შექმნილი გაზიარებული ანგარიშებიდან
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleAccountTypeChange('individual')}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              accountType === 'individual'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <Plus className="w-5 h-5 mr-2 text-blue-600" />
              <span className="font-semibold text-gray-900 dark:text-white">
                ინდივიდუალური ანგარიში
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              შექმენით ახალი ინდივიდუალური ანგარიში ამ კოტეჯისთვის
            </p>
          </button>
        </div>

        {/* Shared Account Selection */}
        {accountType === 'shared' && (
          <div className="space-y-4">
            {sharedAccounts.length > 0 ? (
              <div>
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Share2 className="w-5 h-5 mr-2 text-green-600" />
                  გაზიარებული ანგარიშები ({sharedAccounts.length})
                </h5>
                <div className="space-y-2">
                  {sharedAccounts.map((account) => (
                    <label
                      key={account.id}
                      className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedSharedAccountId === account.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-900 dark:bg-opacity-20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sharedBankAccount"
                        value={account.id}
                        checked={selectedSharedAccountId === account.id}
                        onChange={() => handleSharedAccountSelect(account.id)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {account.bank}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {account.accountNumber}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                              {account.accountHolderName}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 dark:bg-opacity-30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                              🤝 გაზიარებული
                            </span>
                            {selectedSharedAccountId === account.id && (
                              <Check className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  გაზიარებული ანგარიშები არ მოიძებნა
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  შექმენით გაზიარებული ანგარიში ბანკის ანგარიშების გვერდიდან
                </p>
              </div>
            )}
          </div>
        )}

        {/* Individual Account Form */}
        {accountType === 'individual' && (
          <div className="space-y-6">
            <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-blue-600" />
              ინდივიდუალური ანგარიშის შექმნა
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ბანკის არჩევა */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  ბანკის არჩევა *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    value={individualAccountData.bank}
                    onChange={(e) => handleIndividualAccountChange('bank', e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none"
                    required={required}
                  >
                    <option value="">🏦 აირჩიეთ ბანკი</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.name}>
                        🏦 {bank.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                </div>
              </div>

              {/* ანგარიშის მფლობელი */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  ანგარიშის მფლობელი *
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={individualAccountData.accountHolderName}
                    onChange={(e) => handleIndividualAccountChange('accountHolderName', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    placeholder="სრული სახელი"
                    required={required}
                  />
                </div>
              </div>
            </div>

            {/* IBAN */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                ანგარიშის ნომერი (IBAN) *
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={individualAccountData.accountNumber}
                  onChange={(e) => handleIndividualAccountChange('accountNumber', e.target.value.toUpperCase())}
                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    validationError 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                  placeholder="მაგ: GE29NB0000000101904917"
                  maxLength={22}
                  required={required}
                />
              </div>
              {validationError && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  ❌ {validationError}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💳 ქართული IBAN ფორმატი: GE + 2 ციფრი + 18 სიმბოლო (სულ 22 სიმბოლო)
              </p>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-start">
            <div className="text-blue-600 dark:text-blue-400 mr-3">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h6 className="text-blue-800 dark:text-blue-200 font-semibold mb-1">მნიშვნელოვანი ინფორმაცია</h6>
              <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
                <li>• გაზიარებული ანგარიში შეიძლება გამოიყენოს მრავალ კოტეჯში</li>
                <li>• ინდივიდუალური ანგარიში მხოლოდ ამ კოტეჯისთვისაა</li>
                <li>• ანგარიშის ნომერი აისახება ინვოისებში</li>
                <li>• შეამოწმეთ ინფორმაციის სისწორე შენახვამდე</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankAccountField;