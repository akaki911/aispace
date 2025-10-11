import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, storage } from './firebaseConfig';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from './contexts/useAuth';
import { 
  Car, 
  Upload, 
  X, 
  Calendar, 
  Users, 
  Fuel,
  Euro,
  MapPin,
  Settings,
  Shield,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useValidation } from './hooks/useValidation';
import ValidationModal from './components/ValidationModal';
import { Vehicle } from './types/vehicle';
import BankAccountField from './components/BankAccountField';
import { ArrowLeft } from 'lucide-react';

interface VehicleFormData {
  title: string;
  brand: string;
  model: string;
  description: string;
  pricePerHour: number;
  pricePerDay: number;
  capacity: number;
  fuelType: string;
  transmission: string;
  year: number;
  bodyType: string;
  features: string[];
  requiresDriver: boolean;
  excursionServices?: {
    minRate: number;
    maxRate: number;
    description: string;
  };
  bankAccount?: {
    bank: string;
    accountNumber: string;
    accountHolderName: string;
  };
}

export default function VehicleForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const { validationErrors, isValidationModalOpen, hideValidationErrors, validateAndProceed } = useValidation();
  const isEditing = !!id;

  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [form, setForm] = useState<VehicleFormData>({
    title: '',
    brand: '',
    model: '',
    description: '',
    pricePerHour: 0,
    pricePerDay: 0,
    capacity: 4,
    fuelType: 'ბენზინი',
    transmission: 'მექანიკური',
    year: new Date().getFullYear(),
    bodyType: 'სედანი',
    features: [],
    requiresDriver: true,
    excursionServices: {
      minRate: 0,
      maxRate: 0,
      description: ''
    }
  });

  useEffect(() => {
    if (isEditing && id) {
      fetchVehicle();
    }
  }, [id, isEditing]);

  const fetchVehicle = async () => {
    try {
      const vehicleDoc = await getDoc(doc(db, 'vehicles', id!));
      if (vehicleDoc.exists()) {
        const data = vehicleDoc.data() as Vehicle;
        setForm({
          title: data.title || '',
          brand: data.brand || '',
          model: data.model || '',
          description: data.description || '',
          pricePerHour: data.pricePerHour || 0,
          pricePerDay: data.pricePerDay || 0,
          capacity: data.capacity || 4,
          fuelType: data.fuelType || 'ბენზინი',
          transmission: data.transmission || 'მექანიკური',
          year: data.year || new Date().getFullYear(),
          bodyType: data.bodyType || 'სედანი',
          features: data.features || [],
          requiresDriver: data.requiresDriver !== false,
          excursionServices: data.excursionServices || {
            minRate: 0,
            maxRate: 0,
            description: ''
          },
          bankAccount: data.bankAccount || undefined
        });
        setExistingImages(data.images || []);
      }
    } catch (error) {
      console.error('Error fetching vehicle:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setForm(prev => ({ ...prev, [name]: checked }));
    } else if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof VehicleFormData] as any,
          [child]: type === 'number' ? Number(value) : value
        }
      }));
    } else {
      setForm(prev => ({
        ...prev,
        [name]: type === 'number' ? Number(value) : value
      }));
    }
  };

  const handleBankAccountChange = (bankAccount: { bank: string; accountNumber: string; accountHolderName: string } | undefined) => {
    setForm(prev => ({ ...prev, bankAccount }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadPromises = images.map(async (image) => {
      const imageRef = ref(storage, `vehicles/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);
      return getDownloadURL(imageRef);
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const formData = {
      title: form.title,
      brand: form.brand,
      model: form.model,
      description: form.description,
      pricePerHour: form.pricePerHour,
      pricePerDay: form.pricePerDay,
      capacity: form.capacity,
      fuelType: form.fuelType,
      transmission: form.transmission,
      year: form.year,
      bodyType: form.bodyType,
      features: form.features,
      requiresDriver: form.requiresDriver,
      excursionServices: form.excursionServices,
      bankAccount: form.bankAccount
    };

    const proceedWithSubmission = async () => {
      try {
        let imageUrls: string[] = [];

        if (images.length > 0) {
          imageUrls = await uploadImages();
        }

        const allImages = [...existingImages, ...imageUrls];

        const vehicleData = {
          ...form,
          images: allImages,
          mainImageIndex: 0,
          ownerId: user?.uid,
          createdAt: isEditing ? undefined : new Date(),
          updatedAt: new Date()
        };

        if (isEditing) {
          await updateDoc(doc(db, 'vehicles', id!), vehicleData);
          alert('ავტომობილი წარმატებით განახლდა!');
        } else {
          await addDoc(collection(db, 'vehicles'), vehicleData);
          alert('ავტომობილი წარმატებით დაემატა!');
        }

        navigate('/admin/vehicles');
      } catch (error) {
        console.error('Error saving vehicle:', error);
        alert('შეცდომა ავტომობილის შენახვისას. გთხოვთ სცადოთ ხელახლა.');
      } finally {
        setLoading(false);
      }
    };

    // Use global validation service
    validateAndProceed(formData, 'vehicle', proceedWithSubmission);
  };

  const fuelTypes = ['ბენზინი', 'დიზელი', 'ჰიბრიდი', 'ელექტრო'];
  const transmissionTypes = ['მექანიკური', 'ავტომატური'];
  const bodyTypes = ['სედანი', 'ჰეჩბეკი', 'უნივერსალი', 'კროსოვერი', 'ჯიპი', 'მინივენი'];

  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationErrorsList, setValidationErrorsList] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-16">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            უკან დაბრუნება
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {isEditing ? 'ავტომობილის რედაქტირება' : 'ავტომობილის დამატება'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ძირითადი ინფორმაცია */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">სათაური *</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ბრენდი *</label>
                <input
                  type="text"
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">მოდელი *</label>
                <input
                  type="text"
                  name="model"
                  value={form.model}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">წელი *</label>
                <input
                  type="number"
                  name="year"
                  value={form.year}
                  onChange={handleChange}
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">აღწერა *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* ტექნიკური მახასიათებლები */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ადგილების რაოდენობა *</label>
                <input
                  type="number"
                  name="capacity"
                  value={form.capacity}
                  onChange={handleChange}
                  min="1"
                  max="50"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">საწვავის ტიპი *</label>
                <select
                  name="fuelType"
                  value={form.fuelType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {fuelTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">გადაცემათა კოლოფი *</label>
                <select
                  name="transmission"
                  value={form.transmission}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {transmissionTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">კუზოვის ტიპი *</label>
              <select
                name="bodyType"
                value={form.bodyType}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {bodyTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* ფასები */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
              <h3 className="text-lg font-semibold text-blue-800 mb-4">💰 ფასები</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ფასი საათში (ლარი) *</label>
                  <input
                    type="number"
                    name="pricePerHour"
                    value={form.pricePerHour}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ფასი დღეში (ლარი) *</label>
                  <input
                    type="number"
                    name="pricePerDay"
                    value={form.pricePerDay}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>შენიშვნა:</strong> ავტომობილების ფასები ფიქსირებულია მთელი წლის განმავლობაში. 
                  სეზონური ფასები მხოლოდ კოტეჯებსა და სასტუმროებზე ვრცელდება.
                </p>
              </div>
            </div>

            {/* მძღოლის მოთხოვნა */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="requiresDriver"
                  checked={form.requiresDriver}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">მძღოლი სავალდებულოა</span>
              </label>
            </div>

            {/* ექსკურსიის სერვისები */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">ექსკურსიის სერვისები</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">მინიმალური ფასი</label>
                  <input
                    type="number"
                    name="excursionServices.minRate"
                    value={form.excursionServices?.minRate || ''}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">მაქსიმალური ფასი</label>
                  <input
                    type="number"
                    name="excursionServices.maxRate"
                    value={form.excursionServices?.maxRate || ''}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">ექსკურსიის აღწერა</label>
                <textarea
                  name="excursionServices.description"
                  value={form.excursionServices?.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* ბანკის ანგარიშის ინფორმაცია */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">ბანკის ანგარიშის ინფორმაცია</h3>
              <BankAccountField
                value={form.bankAccount}
                onChange={handleBankAccountChange}
                required
              />
            </div>

            {/* სურათები */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">სურათები</h3>

              {existingImages.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">არსებული სურათები</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {existingImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt={`არსებული ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ახალი სურათების დამატება</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {images.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">ახალი სურათები</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`ახალი ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'მუშავდება...' : (isEditing ? 'განახლება' : 'დამატება')}
            </button>
          </form>

          {/* Validation Modal */}
          <ValidationModal
            isOpen={isValidationModalOpen}
            onClose={hideValidationErrors}
            errors={validationErrors}
            title="ავტომობილის ფორმის შევსება დაუსრულებელია"
          />
        </div>
      </div>
    </div>
  );
};