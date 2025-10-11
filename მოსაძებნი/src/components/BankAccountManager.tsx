// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Building, CreditCard, Users, Share2, Eye, AlertTriangle, CheckCircle, Home } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankAccountService } from '../services/bankAccountService';
import { BankAccount, GeorgianBank } from '../types/bank';
import { validateIBAN } from '../utils/validation';
import { useAuth } from '../contexts/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const georgianBanks = [
  { value: 'თიბისი (TBC)', label: '🏦 თიბისი (TBC)' },
  { value: 'საქართველოს ბანკი (Bank of Georgia)', label: '🏦 საქართველოს ბანკი (Bank of Georgia)' },
  { value: 'ლიბერთი ბანკი', label: '🏦 ლიბერთი ბანკი' },
  { value: 'თსს ბანკი', label: '🏦 თსს ბანკი' },
  { value: 'კრედო ბანკი', label: '🏦 კრედო ბანკი' },
  { value: 'ბაზისბანკი', label: '🏦 ბაზისბანკი' },
  { value: 'სითი ბანკი', label: '🏦 სითი ბანკი' },
  { value: 'სხვა ბანკი', label: '🏦 სხვა ბანკი' }
];

interface CottageInfo {
  id: string;
  name: string;
  location: string;
}

const BankAccountManager: React.FC = () => {
  const { user } = useAuth();
  const { canManageSystem } = usePermissions();
  const queryClient = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    bank: '',
    accountNumber: '',
    accountHolderName: ''
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [linkedCottages, setLinkedCottages] = useState<{[accountId: string]: CottageInfo[]}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // გაზიარებული ანგარიშების ჩატვირთვა
  const { data: sharedBankAccounts = [], isLoading, refetch } = useQuery({
    queryKey: ['sharedBankAccounts', user?.uid],
    queryFn: async () => {
      console.log('🔍 BankAccountManager: Starting shared accounts fetch...');

      try {
        const sharedAccounts = await bankAccountService.getSharedBankAccounts(user?.uid);
        console.log('🔍 BankAccountManager: Shared accounts received:', sharedAccounts);
        return sharedAccounts;
      } catch (error) {
        console.error('🔍 BankAccountManager: Error fetching shared accounts:', error);
        return [];
      }
    },
    enabled: !!user?.uid,
    staleTime: 30000, // 30 seconds
    retry: 3
  });

  // მიბმული კოტეჯების ჩატვირთვა
  useEffect(() => {
    const loadLinkedCottages = async () => {
      const cottagesMap: {[accountId: string]: CottageInfo[]} = {};

      for (const account of sharedBankAccounts) {
        try {
          // გაზიარებული ანგარიშზე მიბმული კოტეჯები
          const sharedQuery = query(
            collection(db, 'cottages'),
            where('sharedBankAccountId', '==', account.id)
          );
          const sharedSnapshot = await getDocs(sharedQuery);

          const cottages: CottageInfo[] = [];
          sharedSnapshot.forEach(doc => {
            const data = doc.data();
            cottages.push({
              id: doc.id,
              name: data.name || 'უსახელო კოტეჯი',
              location: data.location || 'მდებარეობა არ არის მითითებული'
            });
          });

          cottagesMap[account.id] = cottages;
        } catch (error) {
          console.error(`Error loading cottages for account ${account.id}:`, error);
        }
      }

      setLinkedCottages(cottagesMap);
    };

    if (sharedBankAccounts.length > 0) {
      loadLinkedCottages();
    }
  }, [sharedBankAccounts]);

  // ახალი გაზიარებული ანგარიშის დამატება
  const addAccountMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const accountData = {
        ...data,
        providerId: user?.uid || '',
        accountType: 'shared' as const, // ყოველთვის გაზიარებული
        isActive: true
      };
      return await bankAccountService.addBankAccount(accountData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedBankAccounts'] });
      setShowAddForm(false);
      resetForm();
      setIsSubmitting(false);
    },
    onError: () => {
      setIsSubmitting(false);
    }
  });

  // ანგარიშის განახლება
  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BankAccount> }) => {
      return await bankAccountService.updateBankAccount(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedBankAccounts'] });
      setEditingAccount(null);
      resetForm();
      setIsSubmitting(false);
    },
    onError: () => {
      setIsSubmitting(false);
    }
  });

  // ანგარიშის წაშლა
  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return await bankAccountService.deleteBankAccount(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedBankAccounts'] });
    }
  });

  const resetForm = () => {
    setFormData({
      bank: '',
      accountNumber: '',
      accountHolderName: ''
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!formData.bank) errors.bank = 'ბანკის არჩევა აუცილებელია';
    if (!formData.accountNumber) {
      errors.accountNumber = 'ანგარიშის ნომერი აუცილებელია';
    } else {
      const ibanValidation = validateIBAN(formData.accountNumber);
      if (!ibanValidation.isValid) {
        errors.accountNumber = ibanValidation.message;
      }
    }
    if (!formData.accountHolderName) errors.accountHolderName = 'მფლობელის სახელი აუცილებელია';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return; // თავიდან ავიცილოთ მრავალჯერადი submit

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (editingAccount) {
        await updateAccountMutation.mutateAsync({
          id: editingAccount.id,
          data: formData
        });
      } else {
        await addAccountMutation.mutateAsync(formData);
      }
    } catch (error) {
      console.error('Error saving account:', error);
      setIsSubmitting(false);
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      bank: account.bank,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountHolderName
    });
    setShowAddForm(true);
  };

  const handleDelete = async (account: BankAccount) => {
    const linkedCount = linkedCottages[account.id]?.length || 0;
    if (linkedCount > 0) {
      alert(`ამ ანგარიშს აქვს ${linkedCount} მიბმული კოტეჯი. ჯერ გამოაკავშირეთ ყველა კოტეჯი.`);
      return;
    }

    if (confirm('დარწმუნებული ხართ, რომ გსურთ ამ ანგარიშის წაშლა?')) {
      deleteAccountMutation.mutate(account.id);
    }
  };

  console.log('🔍 BankAccountManager: Rendering with data:', {
    isLoading,
    sharedBankAccountsCount: sharedBankAccounts?.length || 0,
    sharedBankAccounts,
    canManageSystem,
    userUid: user?.uid
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center mb-2">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-2xl mr-4 shadow-lg">
                <Share2 className="w-8 h-8 text-white" />
              </div>
              გაზიარებული ბანკის ანგარიშები
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              გაზიარებული ანგარიშების მართვა, რომლებიც შეიძლება გამოიყენოს კოტეჯებში
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            ახალი გაზიარებული ანგარიში
          </button>
        </div>
      </div>

      {user?.personalId === "01019062020" && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            🔍 BankAccountManager Debug
          </h4>
          <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <div>Loading: {isLoading ? 'TRUE' : 'FALSE'}</div>
            <div>Shared Accounts Count: {sharedBankAccounts?.length || 0}</div>
            <div>Can Manage System: {canManageSystem ? 'TRUE' : 'FALSE'}</div>
            <div>User UID: {user?.uid || 'NONE'}</div>
            <div>Accounts Data: {JSON.stringify(sharedBankAccounts, null, 2)}</div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 mb-8">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {editingAccount ? 'ანგარიშის რედაქტირება' : 'ახალი გაზიარებული ანგარიშის დამატება'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ბანკის არჩევა */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  ბანკის არჩევა *
                </label>
                <select
                  value={formData.bank}
                  onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    formErrors.bank ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <option value="">აირჩიეთ ბანკი</option>
                  {georgianBanks.map((bank) => (
                    <option key={bank.value} value={bank.value}>
                      {bank.label}
                    </option>
                  ))}
                </select>
                {formErrors.bank && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{formErrors.bank}</p>
                )}
              </div>

              {/* მფლობელის სახელი */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  ანგარიშის მფლობელი *
                </label>
                <input
                  type="text"
                  value={formData.accountHolderName}
                  onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    formErrors.accountHolderName ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                  }`}
                  placeholder="სრული სახელი"
                />
                {formErrors.accountHolderName && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{formErrors.accountHolderName}</p>
                )}
              </div>
            </div>

            {/* IBAN */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                ანგარიშის ნომერი (IBAN) *
              </label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.toUpperCase() })}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                  formErrors.accountNumber ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                }`}
                placeholder="მაგ: GE29NB0000000101904917"
                maxLength={22}
              />
              {formErrors.accountNumber && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{formErrors.accountNumber}</p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    შენახვა...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    შენახვა
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingAccount(null);
                  resetForm();
                }}
                className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl font-semibold transition-all shadow-lg flex items-center"
              >
                <X className="w-5 h-5 mr-2" />
                გაუქმება
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bank Accounts List */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {sharedBankAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <Share2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
              გაზიარებული ანგარიშები არ მოიძებნა
            </h3>
            <p className="text-gray-500 dark:text-gray-500">
              დაამატეთ პირველი გაზიარებული ანგარიში
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sharedBankAccounts.map((account) => {
              const cottages = linkedCottages[account.id] || [];

              return (
                <div key={account.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="bg-green-100 dark:bg-green-900 dark:bg-opacity-30 p-2 rounded-lg">
                          <Share2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {account.bank}
                          </h3>
                          <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                            🤝 გაზიარებული ანგარიში
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">ანგარიშის ნომერი</p>
                          <p className="font-mono text-gray-900 dark:text-white">{account.accountNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">მფლობელი</p>
                          <p className="text-gray-900 dark:text-white">{account.accountHolderName}</p>
                        </div>
                      </div>

                      {/* მიბმული კოტეჯები */}
                      {cottages.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                            <Home className="w-4 h-4 mr-1" />
                            მიბმული კოტეჯები ({cottages.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {cottages.map((cottage) => (
                              <span
                                key={cottage.id}
                                className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                              >
                                {cottage.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {/* რედაქტირების ღილაკი */}
                      <button
                        onClick={() => handleEdit(account)}
                        disabled={cottages.length > 0}
                        className="bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={cottages.length > 0 ? 'მიბმული კოტეჯების გამო რედაქტირება შეუძლებელია' : 'რედაქტირება'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {/* წაშლის ღილაკი */}
                      <button
                        onClick={() => handleDelete(account)}
                        disabled={cottages.length > 0 || deleteAccountMutation.isPending}
                        className="bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={cottages.length > 0 ? 'მიბმული კოტეჯების გამო წაშლა შეუძლებელია' : 'ანგარიშის წაშლა'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BankAccountManager;