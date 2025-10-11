
import React, { useState } from 'react';
import { Star, User, Calendar, MessageSquare, Image as ImageIcon } from 'lucide-react';
import { Review } from '../types/review';

interface ReviewsListProps {
  reviews: Review[];
  showReplyForm?: boolean;
  onReply?: (reviewId: string, reply: string) => Promise<void>;
}

const ReviewsList: React.FC<ReviewsListProps> = ({ reviews, showReplyForm = false, onReply }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const handleReplySubmit = async (reviewId: string) => {
    if (!replyText.trim() || !onReply) return;
    
    setIsSubmittingReply(true);
    try {
      await onReply(reviewId, replyText.trim());
      setReplyingTo(null);
      setReplyText('');
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ka-GE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 9) return 'text-green-600 bg-green-100';
    if (rating >= 7) return 'text-yellow-600 bg-yellow-100';
    if (rating >= 5) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">შეფასებები ჯერ არ არის</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div key={review.id} className="bg-white border border-gray-200 rounded-lg p-6">
          {/* Review Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gray-100 rounded-full p-2">
                <User className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">მომხმარებელი</p>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(review.createdAt)}</span>
                </div>
              </div>
            </div>
            
            {/* Rating Badge */}
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRatingColor(review.rating)}`}>
              {review.rating}/10
            </div>
          </div>

          {/* Comment */}
          <p className="text-gray-700 mb-4 leading-relaxed">{review.comment}</p>

          {/* Photos */}
          {review.photos && review.photos.length > 0 && (
            <div className="mb-4">
              <div className="flex space-x-2">
                {review.photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Review photo ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedImage(photo)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <ImageIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provider Reply */}
          {review.reply && (
            <div className="mt-4 ml-8 p-4 bg-blue-50 border-l-4 border-blue-200 rounded-r-lg">
              <div className="flex items-center space-x-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">პროვაიდერის პასუხი</span>
                <span className="text-xs text-blue-600">
                  {formatDate(review.reply.createdAt)}
                </span>
              </div>
              <p className="text-gray-700">{review.reply.comment}</p>
            </div>
          )}

          {/* Reply Form */}
          {showReplyForm && !review.reply && replyingTo === review.id && (
            <div className="mt-4 ml-8">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="პასუხის დაწერა..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <div className="flex space-x-2 mt-2">
                <button
                  onClick={() => handleReplySubmit(review.id)}
                  disabled={!replyText.trim() || isSubmittingReply}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
                >
                  {isSubmittingReply ? 'იგზავნება...' : 'პასუხის გაგზავნა'}
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyText('');
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  გაუქმება
                </button>
              </div>
            </div>
          )}

          {/* Reply Button */}
          {showReplyForm && !review.reply && replyingTo !== review.id && (
            <div className="mt-4">
              <button
                onClick={() => setReplyingTo(review.id)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                პასუხის დაწერა
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="Review photo"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsList;
