import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Upload, Save, Plus, Minus, X, Star, Camera, AlertCircle, CheckCircle, Bed, Calendar } from 'lucide-react';
import { collection, addDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Hotel, RoomType } from './types/hotel';
import { useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import { logAuditEvent } from './services/auditService';
import { 
  HotelMonthlyPricing, 
  getDefaultHotelPricing, 
  MONTHS, 
  MonthKey 
} from './types/seasonalPricing';
import BankAccountField from './components/BankAccountField';
import { useValidation } from './hooks/useValidation';
import ValidationModal from './components/ValidationModal';

interface FormData {
  name: string;
  description: string;
  location: string;
  amenities: {
    wifi: boolean;
    parking: boolean;
    restaurant: boolean;
    pool: boolean;
    spa: boolean;
    gym: boolean;
    roomService: boolean;
    laundry: boolean;
    airConditioning: boolean;
    heating: boolean;
    elevator: boolean;
    petFriendly: boolean;
  };
  roomTypes: RoomType[];
  images: string[];
  priceByMonth?: HotelMonthlyPricing;
  hasSeasonalPricing: boolean;
  bankName: string;
  bankAccount: string;
  pricingMode: 'standard' | 'flexible';
  flexiblePricing: { [month: string]: number };
}

export default function HotelForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { canEditResource, currentUserId } = usePermissions();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [newRoomType, setNewRoomType] = useState<Partial<RoomType>>({
    name: '',
    pricePerNight: 100,
    capacity: 2,
    description: '',
    amenities: []
  });
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    location: '',
    amenities: {
      wifi: false,
      parking: false,
      restaurant: false,
      pool: false,
      spa: false,
      gym: false,
      roomService: false,
      laundry: false,
      airConditioning: false,
      heating: false,
      elevator: false,
      petFriendly: false
    },
    roomTypes: [],
    images: [],
    priceByMonth: getDefaultHotelPricing(),
    hasSeasonalPricing: false,
    bankName: '',
    bankAccount: '',
    pricingMode: 'standard',
    flexiblePricing: {}
  });

  const { validationErrors, isValidationModalOpen, hideValidationErrors, validateAndProceed } = useValidation();

  // Load existing hotel data if editing
  useEffect(() => {
    if (!id) return;
    const fetchHotel = async () => {
      try {
        const snap = await getDoc(doc(db, 'hotels', id));
        if (snap.exists()) {
          const data = snap.data() as Hotel;

          if (!canEditResource(data.ownerId)) {
            alert('თქვენ არ გაქვთ ამ სასტუმროს რედაქტირების უფლება');
            navigate('/admin/hotels');
            return;
          }

          setFormData({
            name: data.name || '',
            description: data.description || '',
            location: data.location || '',
            amenities: data.amenities || {
              wifi: false, parking: false, restaurant: false,
              pool: false, spa: false, gym: false,
              roomService: false, laundry: false, airConditioning: false,
              heating: false, elevator: false, petFriendly: false
            },
            roomTypes: data.roomTypes || [],
            images: data.images || [],
            priceByMonth: data.priceByMonth || getDefaultHotelPricing(),
            hasSeasonalPricing: data.hasSeasonalPricing || false,
            bankName: data.bankName || '',
            bankAccount: data.bankAccount || '',
            pricingMode: data.pricingMode || 'standard',
            flexiblePricing: data.flexiblePricing || {}
          });
          setMainImageIndex(data.mainImageIndex || 0);
        }
      } catch (error) {
        console.error('Error fetching hotel:', error);
      }
    };
    fetchHotel();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleAmenity = (key: keyof FormData['amenities']) => {
    setFormData(prev => ({
      ...prev,
      amenities: { ...prev.amenities, [key]: !prev.amenities[key] }
    }));
  };

  const addRoomType = () => {
    if (!newRoomType.name?.trim() || !newRoomType.pricePerNight) return;

    const roomType: RoomType = {
      id: Date.now().toString(),
      name: newRoomType.name.trim(),
      pricePerNight: newRoomType.pricePerNight,
      capacity: newRoomType.capacity || 2,
      description: newRoomType.description || '',
      amenities: newRoomType.amenities || []
    };

    setFormData(prev => ({
      ...prev,
      roomTypes: [...prev.roomTypes, roomType]
    }));

    setNewRoomType({
      name: '',
      pricePerNight: 100,
      capacity: 2,
      description: '',
      amenities: []
    });
  };

  const removeRoomType = (index: number) => {
    setFormData(prev => ({
      ...prev,
      roomTypes: prev.roomTypes.filter((_, i) => i !== index)
    }));
  };

  const handleSeasonalPricingToggle = (enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      hasSeasonalPricing: enabled,
      priceByMonth: enabled && prev.pricingMode === 'standard' ? getDefaultHotelPricing() : undefined,
      pricingMode: enabled ? (prev.pricingMode || 'standard') : 'standard',
      flexiblePricing: enabled && prev.pricingMode === 'flexible' ? (prev.flexiblePricing || {}) : {}
    }));
  };

  const handleMonthlyPriceChange = (month: MonthKey, value: number) => {
    if (!formData.priceByMonth) return;

    setFormData(prev => ({
      ...prev,
      priceByMonth: {
        ...prev.priceByMonth!,
        [month]: Math.max(0, value)
      }
    }));
  };

  // Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files).slice(0, 10);
    setUploadStatus(`${files.length} სურათის დამუშავება...`);

    try {
      const base64Images: string[] = [];

      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`სურათი ${i + 1}/${files.length} - დამუშავება...`);
        const base64 = await fileToBase64(files[i]);
        base64Images.push(base64);
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...base64Images]
      }));

      setUploadStatus(`${files.length} სურათი წარმატებით დამუშავდა!`);
      setTimeout(() => setUploadStatus(''), 2000);
    } catch (error) {
      console.error('Error processing images:', error);
      setUploadStatus('შეცდომა სურათების დამუშავებისას');
      setTimeout(() => setUploadStatus(''), 3000);
    }
  };

  const removeImage = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx)
    }));

    if (idx === mainImageIndex) {
      setMainImageIndex(0);
    } else if (idx < mainImageIndex) {
      setMainImageIndex(mainImageIndex - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const proceedWithSubmission = async () => {
      setIsSubmitting(true);
      setUploadStatus('სასტუმროს შენახვა...');

      if (!user) {
        throw new Error('მომხმარებელი არ არის ავტორიზებული');
      }

      try {
        if (!formData.name.trim()) {
          throw new Error('გთხოვთ შეიყვანოთ სასტუმროს სახელი');
        }

        if (!formData.location.trim()) {
          throw new Error('გთხოვთ შეიყვანოთ ლოკაცია');
        }

        let finalImages = formData.images;
        if (finalImages.length === 0) {
          finalImages = [
            'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=800',
            'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=800'
          ];
        }

        const payload: Omit<Hotel, 'id'> = {
          name: formData.name.trim(),
          description: formData.description.trim(),
          location: formData.location.trim(),
          amenities: formData.amenities,
          roomTypes: formData.roomTypes,
          ownerId: currentUserId,
          images: finalImages,
          mainImageIndex: Math.min(mainImageIndex, finalImages.length - 1),
          updatedAt: new Date(),
          priceByMonth: formData.priceByMonth,
          hasSeasonalPricing: formData.hasSeasonalPricing,
          bankName: formData.bankName,
          bankAccount: formData.bankAccount
        };

        if (!id) {
          payload.createdAt = new Date();
        }

        if (id) {
          const oldData = await getDoc(doc(db, 'hotels', id));
          await setDoc(doc(db, 'hotels', id), payload, { merge: true });

          await logAuditEvent(
            user.id,
            user.email,
            'UPDATE',
            'hotel',
            id,
            oldData.exists() ? oldData.data() : null,
            payload
          );

          setUploadStatus('სასტუმრო წარმატებით განახლდა!');
        } else {
          const docRef = await addDoc(collection(db, 'hotels'), payload);

          await logAuditEvent(
            user.id,
            user.email,
            'CREATE',
            'hotel',
            docRef.id,
            null,
            payload
          );

          setUploadStatus('სასტუმრო წარმატებით შეიქმნა!');
        }

        setTimeout(() => {
          navigate('/admin/hotels');
        }, 1500);

      } catch (err) {
        console.error('Error saving hotel:', err);
        setUploadStatus(err instanceof Error ? err.message : 'დაფიქსირდა შეცდომა');
        setTimeout(() => setUploadStatus(''), 3000);
      } finally {
        setIsSubmitting(false);
      }
    };

    // Use global validation service
    validateAndProceed(formData, 'hotel', proceedWithSubmission);
  };

  const amenityIcons = {
    wifi: '📶',
    parking: '🅿️',
    restaurant: '🍽️',
    pool: '🏊',
    spa: '💆',
    gym: '🏋️',
    roomService: '🛎️',
    laundry: '👕',
    airConditioning: '❄️',
    heating: '🔥',
    elevator: '🛗',
    petFriendly: '🐕'
  };

  const amenityLabels = {
    wifi: 'Wi-Fi',
    parking: 'პარკინგი',
    restaurant: 'რესტორანი',
    pool: 'აუზი',
    spa: 'SPA',
    gym: 'სპორტული დარბაზი',
    roomService: 'ოთახის სერვისი',
    laundry: 'სარეცხი სერვისი',
    airConditioning: 'კონდიციონერი',
    heating: 'გათბობა',
    elevator: 'ლიფტი',
    petFriendly: 'შინაური ცხოველები'
  };

    const handleMonthlyPricingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      monthlyPricing: {
        ...prev.monthlyPricing,
        [name]: parseInt(value) || 0
      }
    }));
  };

  const [showValidationModal, setShowValidationModal] = useState(false);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl p-8 border border-purple-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-3xl mb-6 shadow-lg">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-3">
            {id ? 'სასტუმროს რედაქტირება' : 'ახალი სასტუმრო'}
          </h1>
          <p className="text-gray-600 text-lg">შეავსეთ სასტუმროს ინფორმაცია</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center text-purple-800">
              <Building2 className="w-6 h-6 mr-3 text-purple-600" />
              ძირითადი ინფორმაცია
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  სასტუმროს სახელი *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ლოკაცია *
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm"
                  required
                />
              </div>
            </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                აღწერა
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm resize-none"
                placeholder="სასტუმროს დეტალური აღწერა..."
              />
            </div>

           {/* ბანკის ინფორმაცია */}
           <div className="mt-6">
             <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
               💳 ბანკის ანგარიში
             </h4>
             <BankAccountField
               value={formData.bankName && formData.bankAccount ? {
                 bank: formData.bankName,
                 accountNumber: formData.bankAccount,
                 accountHolderName: ''
               } : undefined}
               onChange={(value) => {
                 if (value) {
                   setFormData(prev => ({
                     ...prev,
                     bankName: value.bank,
                     bankAccount: value.accountNumber
                   }));
                 } else {
                   setFormData(prev => ({
                     ...prev,
                     bankName: '',
                     bankAccount: ''
                   }));
                 }
               }}
               required={true}
               showAccountChoice={true}
             />
           </div>
          </div>

          {/* Amenities */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6 text-blue-800">🏨 სერვისები</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(amenityIcons).map(([key, icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleAmenity(key as keyof FormData['amenities'])}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                    formData.amenities[key as keyof FormData['amenities']]
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md scale-105'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-2xl mb-2">{icon}</div>
                  <span className="text-sm font-medium text-center block">
                    {amenityLabels[key as keyof typeof amenityLabels]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* სეზონური ფასები */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">💰</span>
              ფასის პარამეტრები
            </h3>

            {/* სეზონური ფასების ჩართვა/გამორთვა */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.hasSeasonalPricing}
                    onChange={(e) => handleSeasonalPricingToggle(e.target.checked)}
                    className="mr-3 w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="font-medium text-purple-800">სეზონური ფასები (ივნისი-სექტემბერი)</span>
                </label>
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-sm text-purple-700">
                ჩართეთ თუ გსურთ სხვადასხვა ფასები სხვადასხვა თვეებისთვის
              </p>
            </div>

            {formData.hasSeasonalPricing ? (
              /* სეზონური ფასები */
              <div className="space-y-6">
                {/* ფასების მოდის არჩევა */}
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="pricingMode"
                      value="standard"
                      checked={formData.pricingMode === 'standard'}
                      onChange={(e) => setFormData(prev => ({ ...prev, pricingMode: e.target.value as 'standard' | 'flexible' }))}
                      className="mr-2"
                    />
                    <span>სტანდარტული სეზონური ფასები (ივნისი-სექტემბერი)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="pricingMode"
                      value="flexible"
                      checked={formData.pricingMode === 'flexible'}
                      onChange={(e) => setFormData(prev => ({ ...prev, pricingMode: e.target.value as 'standard' | 'flexible' }))}
                      className="mr-2"
                    />
                    <span>მოქნილი ფასები (ნებისმიერი თვე)</span>
                  </label>
                </div>

                {formData.pricingMode === 'standard' ? (
                  /* სტანდარტული სეზონური ფასები */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(MONTHS).filter(([key]) => ['june', 'july', 'august', 'september'].includes(key)).map(([key, georgianName]) => (
                      <div key={key} className="bg-white p-4 rounded-lg border border-purple-200">
                        <h4 className="font-medium text-purple-800 mb-3">{georgianName}</h4>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">ღამეზე ფასი</label>
                          <input
                            type="number"
                            name={key}
                            value={formData.monthlyPricing?.[key as keyof HotelMonthlyPricing] || ''}
                            onChange={handleMonthlyPricingChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="150"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* მოქნილი ფასები */
                  <div className="space-y-4">
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        აირჩიეთ თვეები რომლებისთვისაც გსურთ სპეციალური ფასების დაყენება:
                      </p>
                    </div>

                    {/* თვეების არჩევა */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Object.entries(MONTHS).map(([key, georgianName]) => (
                        <label key={key} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={!!formData.flexiblePricing?.[key]}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  flexiblePricing: {
                                    ...prev.flexiblePricing,
                                    [key]: 150
                                  }
                                }));
                              } else {
                                setFormData(prev => {
                                  const newPricing = { ...prev.flexiblePricing };
                                  delete newPricing[key];
                                  return { ...prev, flexiblePricing: newPricing };
                                });
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{georgianName}</span>
                        </label>
                      ))}
                    </div>

                    {/* არჩეული თვეების ფასები */}
                    {formData.flexiblePricing && Object.keys(formData.flexiblePricing).length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.entries(formData.flexiblePricing).map(([month, price]) => (
                          <div key={month} className="bg-white p-4 rounded-lg border border-purple-200">
                            <h4 className="font-medium text-purple-800 mb-3">{MONTHS[month as keyof typeof MONTHS]}</h4>
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">ღამეზე ფასი</label>
                              <input
                                type="number"
                                value={price}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  setFormData(prev => ({
                                    ...prev,
                                    flexiblePricing: {
                                      ...prev.flexiblePricing,
                                      [month]: value
                                    }
                                  }));
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="150"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  სეზონური ფასები გამორთულია. ნომრების ფასები იქნება ისეთი, როგორც ქვემოთ ნომრების ტიპებშია მითითებული.
                </p>
              </div>
            )}
          </div>

          {/* Room Types */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6 text-green-800 flex items-center">
              <Bed className="w-6 h-6 mr-3 text-green-600" />
              ოთახების ტიპები
            </h3>

            {/* Add new room type */}
            <div className="bg-white p-6 rounded-xl border border-green-200 mb-6">
              <h4 className="font-semibold mb-4 text-green-700">ახალი ოთახის ტიპის დამატება</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">სახელი</label>
                  <input
                    type="text"
                    value={newRoomType.name || ''}
                    onChange={(e) => setNewRoomType(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="მაგ: სტანდარტული"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ფასი ღამეში (₾)</label>
                  <input
                    type="number"
                    value={newRoomType.pricePerNight || ''}
                    onChange={(e) => setNewRoomType(prev => ({ ...prev, pricePerNight: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ტევადობა</label>
                  <input
                    type="number"
                    value={newRoomType.capacity || ''}
                    onChange={(e) => setNewRoomType(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addRoomType}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            </div>

            {/* Room types list */}
            {formData.roomTypes.length > 0 && (
              <div className="space-y-3">
                {formData.roomTypes.map((roomType, index) => (
                  <div key={roomType.id} className="bg-white p-4 rounded-xl border border-green-200 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <span className="font-semibold text-green-800">{roomType.name}</span>
                        <span className="text-green-600">{roomType.pricePerNight}₾/ღამე</span>
                        <span className="text-gray-600 text-sm">{roomType.capacity} ადამიანი</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRoomType(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100 shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center text-indigo-800">
              <Camera className="w-6 h-6 mr-3 text-indigo-600" />
              სურათები
            </h3>

            <div className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFiles}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="w-full p-8 border-2 border-dashed border-indigo-300 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-300 flex flex-col items-center disabled:opacity-50 disabled:cursor-not-allowed bg-white shadow-sm"
                >
                  <Upload className="w-10 h-10 text-indigo-400 mb-3" />
                  <span className="text-indigo-700 font-bold text-lg">სასტუმროს სურათების ატვირთვა</span>
                  <span className="text-sm text-indigo-500 mt-1">მაქს. 10 სურათი • JPG, PNG, WEBP</span>
                </button>
              </div>

              {formData.images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.images.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageUrl}
                        alt={`სურათი ${index + 1}`}
                        className={`w-full aspect-[4/3] object-contain rounded-xl border-3 transition-all duration-300 bg-white shadow-md hover:shadow-lg ${
                          index === mainImageIndex ? 'border-indigo-500 ring-4 ring-indigo-200 scale-105' : 'border-gray-200 hover:border-indigo-300'                        }`}
                        loading="eager"
                        style={{ 
                          imageRendering: 'auto',
                          objectFit: 'contain',
                          width: '100%'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        disabled={isSubmitting}
                        className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 disabled:opacity-50 shadow-xl hover:scale-110"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      {index === mainImageIndex && (
                        <div className="absolute bottom-3 left-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm px-3 py-2 rounded-xl flex items-center shadow-lg">
                          <Star className="w-4 h-4 mr-2" />
                          მთავარი
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setMainImageIndex(index)}
                        disabled={isSubmitting}
                        className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-300 rounded-xl disabled:cursor-not-allowed"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Status indicator */}
          {uploadStatus && (
            <div className={`p-5 rounded-2xl border-2 flex items-center shadow-lg ${
              uploadStatus.includes('წარმატებით') || uploadStatus.includes('დამუშავდა')
                ? 'bg-green-50 border-green-300 text-green-800'
                : uploadStatus.includes('შეცდომა')
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-blue-50 border-blue-300 text-blue-800'
            }`}>
              {uploadStatus.includes('წარმატებით') || uploadStatus.includes('დამუშავდა') ? (
                <CheckCircle className="w-6 h-6 mr-4 flex-shrink-0" />
              ) : uploadStatus.includes('შეცდომა') ? (
                <AlertCircle className="w-6 h-6 mr-4 flex-shrink-0" />
              ) : (
                <div className="animate-spin rounded-full h-6 w-6 border-3 border-current border-t-transparent mr-4 flex-shrink-0"></div>
              )}
              <span className="font-bold text-lg">{uploadStatus}</span>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-6 pt-8 pb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={isSubmitting}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:scale-105 shadow-md"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name.trim() || !formData.location.trim()}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:scale-105 shadow-lg flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent mr-3"></div>
                  შენახვა...
                </>
              ) : (
                <>
                  <Save className="w-6 h-6 mr-3" />
                  შენახვა
                </>
              )}
            </button>
          </div>

          {/* Validation Modal */}
          <ValidationModal
            isOpen={isValidationModalOpen}
            onClose={hideValidationErrors}
            errors={validationErrors}
            title="სასტუმროს ფორმის შევსება დაუსრულებელია"
          />
        </form>
      </div>
    </div>
  );
}