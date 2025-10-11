import React from 'react';
import { X, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface TermsAgreementModalProps {
  isOpen: boolean;
  onAgree: () => void;
  onDisagree: () => void;
  userEmail: string;
}

const TermsAgreementModal: React.FC<TermsAgreementModalProps> = ({
  isOpen,
  onAgree,
  onDisagree,
  userEmail
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">პლატფორმის გამოყენების წესები</h2>
          </div>
        </div>

        <div className="mb-6">
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-800">კეთილი იყოს თქვენი მობრძანება!</h3>
                <p className="text-blue-700 text-sm mt-1">
                  {userEmail}, პლატფორმის გამოყენების წინ, გთხოვთ, გაეცნოთ და დაეთანხმოთ ჩვენს პირობებს.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg mb-6 max-h-64 overflow-y-auto">
          <h3 className="font-semibold text-gray-800 mb-4">წესები და პირობები:</h3>

          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">1. პლატფორმის გამოყენება</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>თქვენ ვალდებული ხართ განათავსოთ მხოლოდ ზუსტი და სრული ინფორმაცია</li>
                <li>ობიექტების ფოტოები უნდა იყოს ნამდვილი და მიმდინარე</li>
                <li>ფასები უნდა იყოს აკრუალური და გადამოწმებული</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-800 mb-2">2. კლიენტებთან ურთიერთობა</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>კლიენტებთან უნდა იყოთ ღია და გამჭვირვალე</li>
                <li>ჯავშნების დადასტურება უნდა მოხდეს 24 საათის განმავლობაში</li>
                <li>გაუქმების შესახებ უნდა ეცნობოთ დროულად</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-800 mb-2">3. ხარისხისა და უსაფრთხოების სტანდარტები</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>თქვენი ობიექტი უნდა შეესაბამებოდეს უსაფრთხოების სტანდარტებს</li>
                <li>სისუფთავე და ჰიგიენა უნდა იყოს შენარჩუნებული</li>
                <li>ყველა აღჭურვილობა უნდა იყოს გამართული</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-800 mb-2">4. ფინანსური ვალდებულებები</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>კომისიის გადახდა ხდება ყოველი წარმატებული ჯავშნის შემდეგ</li>
                <li>ფასების შეცვლა დასაშვებია მხოლოდ წინასწარ შეთანხმებით</li>
                <li>დაბრუნება ხდება პლატფორმის წესების შესაბამისად</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-gray-800 mb-2">5. წესების დარღვევა</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>წესების სისტემური დარღვევა შეიძლება გამოიწვიოს ანგარიშის შეჩერება</li>
                <li>ყალბი ინფორმაციის მიცემა იქნება მკაცრად დაჯარიმებული</li>
                <li>მხარდაჭერის სამსახური ხელმისაწვდომია 24/7</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={onAgree}
            className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span>ვეთანხმები წესებს</span>
          </button>
          <button
            onClick={onDisagree}
            className="flex-1 bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
          >
            <X className="w-5 h-5" />
            <span>უარი</span>
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          წესების დადასტურებით თქვენ ავტომატურად ეთანხმებით ჩვენს მომსახურების პირობებს
        </div>
      </div>
    </div>
  );
};

export default TermsAgreementModal;