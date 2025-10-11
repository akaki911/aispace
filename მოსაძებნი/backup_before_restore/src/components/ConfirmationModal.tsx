import React, { useState, useEffect } from 'react';
import { CheckCircle, X, Calendar, Users, DollarSign, Home, MapPin, CreditCard, Download, Clock, Building } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { downloadInvoice, InvoiceData } from '../utils/pdfGenerator';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingData: {
    cottageId: string;
    cottageName: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    depositAmount: number;
    customerName: string;
	firstName: string;
	lastName: string;
	phone: string;
	personalId: string;
	adults: number;
	children: number;
	customTotalPrice: number;
	useCustomPrice: boolean;
	notes: string;

  };
}

export default function ConfirmationModal({ isOpen, onClose, bookingData }: ConfirmationModalProps) {
  const [bankAccount, setBankAccount] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [cottageData, setCottageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!isOpen || !bookingData.cottageId) return;

    const fetchCottageDetails = async () => {
      try {
        const cottageDoc = await getDoc(doc(db, 'cottages', bookingData.cottageId));
        if (cottageDoc.exists()) {
          const data = cottageDoc.data();
          setBankAccount(data.bankAccount || '');
          setBankName(data.bankName || '');
        }
      } catch (error) {
        console.error('Error fetching cottage details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCottageDetails();
  }, [isOpen, bookingData.cottageId]);

  if (!isOpen) return null;

  const remainingAmount = bookingData.totalPrice - bookingData.depositAmount;
  const nights = Math.ceil((bookingData.endDate.getTime() - bookingData.startDate.getTime()) / (1000 * 60 * 60 * 24));

  const calculateNights = () => {
    const diffTime = bookingData.endDate.getTime() - bookingData.startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleDownloadInvoice = async () => {
    try {
      setIsDownloadingPdf(true);

      // Prepare invoice data
      const invoiceData: InvoiceData = {
        firstName: bookingData.firstName || 'მომხმარებელი',
        lastName: bookingData.lastName || '',
        phone: bookingData.phone || '',
        personalId: bookingData.personalId || '',
        cottageId: bookingData.cottageId,
        cottageName: bookingData.cottageName,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        adults: bookingData.adults,
        children: bookingData.children,
        totalPrice: bookingData.totalPrice,
        depositAmount: bookingData.depositAmount,
        remainingAmount: bookingData.totalPrice - bookingData.depositAmount,
        customTotalPrice: bookingData.customTotalPrice,
        useCustomPrice: bookingData.useCustomPrice,
        notes: bookingData.notes,
        createdAt: new Date()
      };

      await downloadInvoice(invoiceData);

    } catch (error) {
      console.error('❌ Error downloading invoice:', error);
      alert('ინვოისის ჩამოტვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 mr-3" />
              <div>
                <h2 className="text-2xl font-bold">ჯავშანი წარმატებულია! 🎉</h2>
                <p className="text-green-100">თქვენი ჯავშნის დეტალები</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Booking Details */}
          <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
              📋 ჯავშნის დეტალები
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">კოტეჯი:</span>
                <span className="font-semibold text-gray-800">{bookingData.cottageName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">მომხმარებელი:</span>
                <span className="font-semibold text-gray-800">{bookingData.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">ჩამოსვლა:</span>
                <span className="font-semibold text-gray-800">
                  {bookingData.startDate.toLocaleDateString('ka-GE')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">წასვლა:</span>
                <span className="font-semibold text-gray-800">
                  {bookingData.endDate.toLocaleDateString('ka-GE')}
                </span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-gray-600">ღამეები:</span>
                <span className="font-bold text-blue-700">{nights}</span>
              </div>
            </div>
          </div>

          {/* Pricing Details */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-xl border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-800 mb-4 flex items-center">
              💰 ფინანსური დეტალები
            </h3>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-orange-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-orange-700 font-medium">ჯამური ღირებულება:</span>
                  <span className="text-2xl font-bold text-orange-800">{bookingData.totalPrice}₾</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-orange-600">გადახდილი (ჯავშნის თანხა):</span>
                  <span className="font-semibold text-green-700">{bookingData.depositAmount}₾</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t mt-2 pt-2">
                  <span className="text-orange-600">გადასახდელი ჩეკინზე:</span>
                  <span className="font-bold text-red-700">{remainingAmount}₾</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          {!loading && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                💳 გადახდის ინფორმაცია
              </h3>

              <div className="space-y-4">
                {/* Bank Information */}
                <div className="bg-white rounded-lg p-5 border border-green-100 shadow-sm">
                  <h4 className="font-bold text-green-700 mb-4 flex items-center text-lg">
                    🏦 ბანკის რეკვიზიტები
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-green-700 font-semibold">ბანკი:</span>
                        <span className="font-bold text-green-800 text-lg">
                          {bankName || '❌ ბანკის ინფორმაცია არ არის მითითებული'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-700 font-semibold">ანგარიშის ნომერი:</span>
                        <span className="font-mono text-sm bg-blue-100 px-3 py-2 rounded-lg font-bold text-blue-800">
                          {bankAccount || '❌ ანგარიშის ნომერი არ არის მითითებული'}
                        </span>
                      </div>
                    </div>

                    {/* კოპირების ინსტრუქცია */}
                    {bankAccount && (
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <p className="text-yellow-800 text-sm font-medium">
                          💡 ანგარიშის ნომერი სკოპირებისთვის შეგიძლიათ დააკლიკოთ მასზე
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Amount */}
                <div className="bg-orange-100 rounded-lg p-4 border border-orange-200">
                  <h4 className="font-semibold text-orange-800 mb-3">💰 გადასახდელი თანხა</h4>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-700 mb-2">
                      {bookingData.depositAmount}₾
                    </div>
                    <div className="text-sm text-orange-600 font-medium">
                      ჯავშნის თანხა (ახლა გადასახდელი)
                    </div>
                  </div>
                </div>

                {/* Remaining Amount */}
                <div className="bg-blue-100 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-3">🏠 დარჩენილი თანხა</h4>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-700 mb-2">
                      {remainingAmount}₾
                    </div>
                    <div className="text-sm text-blue-600 font-medium">
                      ჩეკინის დღეს ქეშად გადასახდელი
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Important Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start">
              <Clock className="w-6 h-6 text-yellow-600 mr-3 mt-1" />
              <div>
                <h4 className="text-yellow-800 font-semibold mb-2">⚠️ მნიშვნელოვანი ინფორმაცია</h4>
                <div className="text-yellow-700 text-sm space-y-2">
                  <p>✅ თქვენი ჯავშანი შეიქმნა და დროებით დარეზერვებულია.</p>
                  <p>⏱️ ჯავშნის თარიღები დაცულია მხოლოდ <strong>15 წუთით</strong>.</p>
                  <p>❗ თუ ამ პერიოდში არ მოხდება გადახდის დადასტურება, ჯავშნის თარიღები კვლავ გახდება ხელმისაწვ</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              გასაგებია
            </button>
          </div>
        </div>
        {/* ღილაკები */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl">
          <div className="flex gap-4">
            <button
              onClick={handleDownloadInvoice}
              disabled={isDownloadingPdf}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isDownloadingPdf ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  გენერირება...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  ჩამოტვირთე ინვოისი (PDF)
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
            >
              დახურვა
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}