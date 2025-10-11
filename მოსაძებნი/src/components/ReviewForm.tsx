
import React, { useState } from 'react';
import { Star, Upload, X } from 'lucide-react';
import { ReviewFormData } from '../types/review';

interface ReviewFormProps {
  onSubmit: (reviewData: ReviewFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ onSubmit, onCancel, isSubmitting = false }) => {
  const [rating, setRating] = useState<number>(1);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const validFiles = files.slice(0, 2 - photos.length); // Max 2 photos total
      
      validFiles.forEach(file => {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          alert('ფაილის ზომა არ უნდა აღემატებოდეს 5MB-ს');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoPreviewUrls(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
      
      setPhotos(prev => [...prev, ...validFiles]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!comment.trim()) {
      alert('გთხოვთ დაწეროთ კომენტარი');
      return;
    }

    const reviewData: ReviewFormData = {
      rating,
      comment: comment.trim(),
      photos
    };

    await onSubmit(reviewData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">შეფასების დატოვება</h3>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating Scale */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                შეფასება (1-10 ქულა)
              </label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`w-8 h-8 rounded-full border-2 text-sm font-medium transition-colors ${
                      rating >= value
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300 text-gray-400 hover:border-blue-300'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">არჩეული ქულა: {rating}</p>
            </div>

            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                კომენტარი *
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="გთხოვთ დაწეროთ თქვენი გამოცდილება..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
                required
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ფოტოები (მაქსიმუმ 2)
              </label>
              
              {photos.length < 2 && (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">ფოტოს ატვირთვა</p>
                    <p className="text-xs text-gray-400">(მაქს. 5MB)</p>
                  </div>
                </label>
              )}

              {photoPreviewUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {photoPreviewUrls.map((url, index) => (
                    <div key={index} className="relative">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                გაუქმება
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !comment.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {isSubmitting ? 'იგზავნება...' : 'შეფასების დატოვება'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ReviewForm;
