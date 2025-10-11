
import React, { useState } from 'react';
import { Building, CreditCard } from 'lucide-react';

interface BankInfo {
  bankName: string;
  bankAccount: string;
}

interface BankInfoFormProps {
  bankInfo: BankInfo;
  onChange: (bankInfo: BankInfo) => void;
  className?: string;
  showAccountChoice?: boolean;
}

const georgianBanks = [
  { value: 'თიბისი (TBC)', label: '🏦 თიბისი (TBC)' },
  { value: 'საქართველოს ბანკი (Bank of Georgia)', label: '🏦 საქართველოს ბანკი (Bank of Georgia)' },
  { value: 'ლიბერთი ბანკი', label: '🏦 ლიბერთი ბანკი' },
  { value: 'თსს ბანკი', label: '🏦 თსს ბანკი' },
  { value: 'კრედო ბანკი', label: '🏦 კრედო ბანკი' },
  { value: 'ბაზისბანკი', label: '🏦 ბაზისბანკი' },
  { value: 'სითი ბანკი', label: '🏦 სითი ბანკი' },
  { value: 'სხვა', label: '🏦 სხვა ბანკი' }
];

export default function BankInfoForm({ 
  bankInfo, 
  onChange, 
  className = '', 
  showAccountChoice = true 
}: BankInfoFormProps) {
  const [accountType, setAccountType] = useState<'individual' | 'shared'>('individual');
  const [customBankName, setCustomBankName] = useState('');

  const handleBankChange = (field: keyof BankInfo, value: string) => {
    onChange({
      ...bankInfo,
      [field]: value
    });
  };

  return (
    <div className={`bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl border border-green-200 ${className}`}>
      <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
        <Building className="w-5 h-5 mr-2" />
        🏦 ბანკის ინფორმაცია
      </h3>
      
      <div className="space-y-4">
        {/* Account Type Selection */}
        {showAccountChoice && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">
              📊 ანგარიშის ტიპის არჩევანი
            </h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="accountType"
                  value="individual"
                  checked={accountType === 'individual'}
                  onChange={(e) => setAccountType(e.target.value as 'individual' | 'shared')}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm text-blue-700">
                  🎯 ინდივიდუალური ანგარიში ამ ობიექტისთვის
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="accountType"
                  value="shared"
                  checked={accountType === 'shared'}
                  onChange={(e) => setAccountType(e.target.value as 'individual' | 'shared')}
                  className="mr-2 text-blue-600"
                />
                <span className="text-sm text-blue-700">
                  🤝 გაზიარებული ანგარიში სხვა ობიექტებთან ერთად
                </span>
              </label>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              💡 ამ ობიექტისთვის შესაძლებელია ინდივიდუალური ან გაზიარებული ანგარიშის გამოყენება — ეს არჩევანს მეპატრონე განსაზღვრავს დამატებისას.
            </p>
          </div>
        )}

        {/* ბანკის არჩევანი */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ბანკის არჩევანი *
          </label>
          <select
            value={bankInfo.bankName}
            onChange={(e) => {
              handleBankChange('bankName', e.target.value);
              if (e.target.value !== 'სხვა') {
                setCustomBankName('');
              }
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white shadow-sm transition-all duration-200 hover:border-gray-400"
            required
          >
            <option value="">🏦 აირჩიეთ ბანკი</option>
            {georgianBanks.map((bank) => (
              <option key={bank.value} value={bank.value}>
                {bank.label}
              </option>
            ))}
          </select>
        </div>

        {/* ბანკის სახელი (თუ "სხვა" არჩეულია) */}
        {bankInfo.bankName === 'სხვა' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ბანკის სახელი *
            </label>
            <input
              type="text"
              value={customBankName}
              onChange={(e) => {
                setCustomBankName(e.target.value);
                handleBankChange('bankName', e.target.value);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm transition-all duration-200"
              placeholder="მიუთითეთ ბანკის სახელი"
              required
            />
          </div>
        )}

        {/* ანგარიშის ნომერი */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <CreditCard className="w-4 h-4 mr-1" />
            ანგარიშის ნომერი (IBAN) *
          </label>
          <input
            type="text"
            value={bankInfo.bankAccount}
            onChange={(e) => handleBankChange('bankAccount', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 shadow-sm transition-all duration-200"
            placeholder="მაგ. GE29TB7194336080100003"
            required
          />
          <div className="mt-2 text-xs text-gray-500">
            <p>💡 ანგარიშის ნომერი უნდა შეიცავდეს 22 სიმბოლოს (IBAN ფორმატში)</p>
          </div>
        </div>

        {/* ბანკის ინფორმაციის მითითება */}
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-start">
            <div className="text-green-600 mr-3">ℹ️</div>
            <div>
              <h4 className="text-green-800 font-semibold mb-1">ანგარიშის ინფორმაცია</h4>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• {accountType === 'individual' ? 'ეს ანგარიში გამოიყენება მხოლოდ ამ ობიექტისთვის' : 'ეს ანგარიში გაზიარდება სხვა ობიექტებთან'}</li>
                <li>• მომხმარებლები ამ ანგარიშზე გადაიხდიან ჯავშნის თანხას</li>
                <li>• ანგარიშის ნომერი აისახება ინვოისებში</li>
                <li>• დარწმუნდით რომ ინფორმაცია სწორია</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { BankInfo };
