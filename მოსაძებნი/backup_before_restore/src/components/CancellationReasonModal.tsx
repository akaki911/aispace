
import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface CancellationReasonModalProps {
  isOpen: boolean;
  bookingId: string;
  bookingType: 'cottage' | 'vehicle' | 'hotel';
  onClose: () => void;
  onReasonSubmitted: () => void;
}

const CancellationReasonModal: React.FC<CancellationReasonModalProps> = ({
  isOpen,
  bookingId,
  bookingType,
  onClose,
  onReasonSubmitted
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      const collectionName = bookingType === 'cottage' ? 'bookings' 
        : bookingType === 'vehicle' ? 'vehicleBookings' 
        : 'hotelBookings';
      
      const bookingRef = doc(db, collectionName, bookingId);
      await updateDoc(bookingRef, {
        'cancellation.reason': reason.trim(),
        hasSeenCancelModal: true
      });

      // Store in localStorage that user has seen this modal for this booking
      localStorage.setItem(`cancelModal_${bookingId}`, 'true');
      
      onReasonSubmitted();
      onClose();
    } catch (error) {
      console.error('Error updating cancellation reason:', error);
      alert('შეცდომა მიზეზის შენახვისას');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">ჯავშნის გაუქმება</h2>
                <p className="text-sm text-gray-500">თქვენს მიერ ჯავშნის ვადა ამოიწურა</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Message */}
          <div className="mb-6">
            <p className="text-gray-700 leading-relaxed">
              თქვენი ჯავშანი ავტომატურად გაუქმდა, რადგან 15 წუთის განმავლობაში არ მოხდა 
              ჯავშნის თანხის გადახდა. გთხოვთ მიუთითოთ გაუქმების მიზეზი.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                გაუქმების მიზეზი *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="მაგ. ვერ მოვასწარი გადახდა, შეცდომით გავაკეთე, ვეღარ მჭირდება..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                გაუქმება
              </button>
              <button
                type="submit"
                disabled={!reason.trim() || isSubmitting}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition-colors font-medium"
              >
                {isSubmitting ? 'იგზავნება...' : 'გაგზავნა'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CancellationReasonModal;
