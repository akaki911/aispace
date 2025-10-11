
import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebaseConfig';
import { useAuth } from './contexts/useAuth';
import { Activity, Save, X, Upload, Trash2 } from 'lucide-react';

interface Horse {
  id?: string;
  name: string;
  breed: string;
  pricePerDay: number;
  pricePerHour: number;
  age: number;
  color: string;
  height: string;
  temperament: string;
  experience: string;
  isAvailable: boolean;
  ownerId?: string;
  location: string;
  createdAt?: Date;
  updatedAt?: Date;
  images?: string[];
  description?: string;
}

interface HorseFormProps {
  editingHorse?: Horse | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function HorseForm({ editingHorse, onSave, onCancel }: HorseFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    breed: '',
    pricePerDay: 0,
    pricePerHour: 0,
    age: 0,
    color: '',
    height: '',
    temperament: '',
    experience: '',
    location: '',
    description: '',
    isAvailable: true
  });

  useEffect(() => {
    if (editingHorse) {
      setFormData({
        name: editingHorse.name || '',
        breed: editingHorse.breed || '',
        pricePerDay: editingHorse.pricePerDay || 0,
        pricePerHour: editingHorse.pricePerHour || 0,
        age: editingHorse.age || 0,
        color: editingHorse.color || '',
        height: editingHorse.height || '',
        temperament: editingHorse.temperament || '',
        experience: editingHorse.experience || '',
        location: editingHorse.location || '',
        description: editingHorse.description || '',
        isAvailable: editingHorse.isAvailable ?? true
      });
      setExistingImages(editingHorse.images || []);
    }
  }, [editingHorse]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadPromises = images.map(async (image) => {
      const imageRef = ref(storage, `horses/${Date.now()}_${image.name}`);
      const snapshot = await uploadBytes(imageRef, image);
      return await getDownloadURL(snapshot.ref);
    });

    return await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.breed.trim() || !formData.location.trim()) {
      alert('გთხოვთ შეავსოთ ყველა სავალდებულო ველი');
      return;
    }

    try {
      setLoading(true);

      const uploadedImageUrls = await uploadImages();
      const allImages = [...existingImages, ...uploadedImageUrls];

      const horseData = {
        ...formData,
        images: allImages,
        ownerId: user?.uid,
        updatedAt: new Date()
      };

      if (editingHorse?.id) {
        await updateDoc(doc(db, 'horses', editingHorse.id), horseData);
        alert('ცხენი წარმატებით განახლდა!');
      } else {
        await addDoc(collection(db, 'horses'), {
          ...horseData,
          createdAt: new Date()
        });
        alert('ცხენი წარმატებით დაემატა!');
      }

      onSave();
    } catch (error) {
      console.error('Error saving horse:', error);
      alert('შეცდომა ცხენის შენახვისას');
    } finally {
      setLoading(false);
    }
  };

  const breeds = [
    'არაბული', 'თუშური', 'ინგლისური სისხლისფერი', 'ანდალუზიური',
    'ფრიზიული', 'კლაიდსდალი', 'მუსტანგი', 'კვარტერჰორსი', 'სხვა'
  ];

  const temperaments = [
    'მშვიდი', 'ენერგიული', 'მისი', 'დამოუკიდებელი', 'მეგობრული'
  ];

  const experienceLevels = [
    'დამწყები', 'საშუალო', 'გამოცდილი', 'პროფესიონალი'
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Activity className="w-6 h-6 mr-2 text-brown-600" />
          {editingHorse ? 'ცხენის რედაქტირება' : 'ახალი ცხენის დამატება'}
        </h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ცხენის სახელი *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ჯიში *
            </label>
            <select
              name="breed"
              value={formData.breed}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            >
              <option value="">აირჩიეთ ჯიში</option>
              {breeds.map(breed => (
                <option key={breed} value={breed}>{breed}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ასაკი (წლები)
            </label>
            <input
              type="number"
              name="age"
              value={formData.age || ''}
              onChange={handleInputChange}
              min="1"
              max="30"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ფერი
            </label>
            <input
              type="text"
              name="color"
              value={formData.color}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              სიმაღლე
            </label>
            <input
              type="text"
              name="height"
              value={formData.height}
              onChange={handleInputChange}
              placeholder="მაგ: 160 სმ"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ტემპერამენტი
            </label>
            <select
              name="temperament"
              value={formData.temperament}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">აირჩიეთ ტემპერამენტი</option>
              {temperaments.map(temp => (
                <option key={temp} value={temp}>{temp}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              გამოცდილების დონე
            </label>
            <select
              name="experience"
              value={formData.experience}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">აირჩიეთ დონე</option>
              {experienceLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              მდებარეობა *
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ფასი საათში (₾)
            </label>
            <input
              type="number"
              name="pricePerHour"
              value={formData.pricePerHour || ''}
              onChange={handleInputChange}
              min="0"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ფასი დღეში (₾)
            </label>
            <input
              type="number"
              name="pricePerDay"
              value={formData.pricePerDay || ''}
              onChange={handleInputChange}
              min="0"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            აღწერა
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={4}
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-brown-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ფოტოები
          </label>
          <div className="space-y-4">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brown-50 file:text-brown-700 hover:file:bg-brown-100"
            />
            
            {/* Display images */}
            {(existingImages.length > 0 || images.length > 0) && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {existingImages.map((url, index) => (
                  <div key={`existing-${index}`} className="relative">
                    <img src={url} alt={`ცხენი ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeImage(index, true)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {images.map((file, index) => (
                  <div key={`new-${index}`} className="relative">
                    <img src={URL.createObjectURL(file)} alt={`ახალი ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => removeImage(index, false)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="isAvailable"
            checked={formData.isAvailable}
            onChange={handleCheckboxChange}
            className="h-4 w-4 text-brown-600 focus:ring-brown-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-900 dark:text-white">
            ხელმისაწვდომია დაქირავებისთვის
          </label>
        </div>

        <div className="flex gap-4 pt-6">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-brown-600 to-amber-600 hover:from-brown-700 hover:to-amber-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            {editingHorse ? 'განახლება' : 'შენახვა'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center"
          >
            <X className="w-5 h-5 mr-2" />
            გაუქმება
          </button>
        </div>
      </form>
    </div>
  );
}
