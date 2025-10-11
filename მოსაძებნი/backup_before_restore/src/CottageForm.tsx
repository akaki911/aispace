import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Save, 
  MapPin, 
  Upload, 
  X, 
  Plus, 
  Trash2, 
  Users, 
  DollarSign, 
  Home,
  ChevronDown,
  ChevronUp,
  Copy,
  Wifi,
  Car,
  Bath,
  Zap,
  Droplets,
  Flame,
  Heater,
  Wind,
  Shirt,
  Building,
  Trees,
  Utensils,
  CheckCircle,
  AlertCircle,
  Info,
  Moon,
  Sun,
  GripVertical,
  Star,
  ImageIcon,
  Calendar,
  Bed,
  Sofa,
  Snowflake,
  Sun as SunIcon,
  Leaf,
  MapleLeaf,
  Shield,
  Clock,
  Settings,
  CreditCard,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useDarkMode } from './hooks/useDarkMode';
import BankAccountField from './components/BankAccountField';
import { validateIBAN } from './utils/validation';
import { useUIErrorCapture } from './hooks/useUIErrorCapture';
import { useValidation } from './hooks/useValidation';
import ValidationModal from './components/ValidationModal';
import WarningToast from './components/WarningToast';

interface FormData {
  name: string;
  description: string;
  location: string;
  pricePerNight: string;
  maxGuests: string;
  bedrooms: string;
  bathrooms: string;
  extraBeds: string;
  commonAreas: string;
  features: string[];
  latitude: string;
  longitude: string;
  monthlyPricing: {
    [month: string]: { min: string; max: string };
  };
  amenities: {
    [key: string]: boolean;
  };
  bankInfo: {
    bankName: string;
    bankAccount: string;
    accountHolderName: string;
  };
}

const COTTAGE_AMENITIES = [
  { key: 'hotWater', label: 'ცხელი წყალი', icon: Droplets },
  { key: 'coldWater', label: 'ცივი წყალი', icon: Droplets },
  { key: 'gas', label: 'გაზი', icon: Flame },
  { key: 'electricity', label: 'ელექტროენერგია', icon: Zap },
  { key: 'heater', label: 'გამათბობელი', icon: Heater },
  { key: 'fireplace', label: 'ბუხარი', icon: Flame },
  { key: 'chimney', label: 'ბორანო', icon: Wind },
  { key: 'linens', label: 'თეთრეული', icon: Shirt },
  { key: 'washingMachine', label: 'სარეცხი მანქანა', icon: Wind },
  { key: 'bathroom', label: 'საშხაპე', icon: Bath },
  { key: 'terrace', label: 'ტერასა', icon: Building },
  { key: 'balcony', label: 'აივანი', icon: Building },
  { key: 'outdoorFurniture', label: 'ღია ცის ქვეშ ავეჯი', icon: Sofa },
  { key: 'bbq', label: 'მწვადი', icon: Utensils },
  { key: 'parkingNear', label: 'პარკინგი (ახლოს)', icon: Car },
  { key: 'parkingFar', label: 'პარკინგი (შორს)', icon: Car },
  { key: 'wifi', label: 'WiFi', icon: Wifi },
  { key: 'yard', label: 'ეზო', icon: Trees },
  { key: 'nearForest', label: 'ტყესთან', icon: Trees },
  { key: 'generator', label: 'გენერატორი', icon: Zap },
  { key: 'solarPanels', label: 'მზის პანელები', icon: SunIcon },
  { key: 'securitySystem', label: 'უსაფრთხოების სისტემა', icon: Shield },
  { key: 'kitchen', label: 'სამზარეულო', icon: Utensils },
  { key: 'refrigerator', label: 'მაცივარი', icon: Snowflake }
];

const ALL_MONTHS = [
  { key: 'january', label: 'იანვარი', emoji: '❄️' },
  { key: 'february', label: 'თებერვალი', emoji: '❄️' },
  { key: 'march', label: 'მარტი', emoji: '🌸' },
  { key: 'april', label: 'აპრილი', emoji: '🌸' },
  { key: 'may', label: 'მაისი', emoji: '🌿' },
  { key: 'june', label: 'ივნისი', emoji: '☀️' },
  { key: 'july', label: 'ივლისი', emoji: '☀️' },
  { key: 'august', label: 'აგვისტო', emoji: '☀️' },
  { key: 'september', label: 'სექტემბერი', emoji: '🍂' },
  { key: 'october', label: 'ოქტომბერი', emoji: '🍂' },
  { key: 'november', label: 'ნოემბერი', emoji: '🍂' },
  { key: 'december', label: 'დეკემბერი', emoji: '❄️' }
];

const DEFAULT_MONTHS = ['june', 'july', 'august'];

const CottageForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { captureUIError, wrapAction } = useUIErrorCapture('CottageForm');

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    location: '',
    pricePerNight: '',
    maxGuests: '',
    bedrooms: '',
    bathrooms: '',
    extraBeds: '',
    commonAreas: '',
    features: [''],
    latitude: '',
    longitude: '',
    monthlyPricing: {},
    amenities: {},
    bankInfo: {
      bankName: '',
      bankAccount: '',
      accountHolderName: ''
    }
  });

  const [images, setImages] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    pricing: false,
    amenities: false,
    images: false,
    location: false,
    bank: false
  });
  const [stickySection, setStickySection] = useState('');
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [activeMonths, setActiveMonths] = useState<string[]>(DEFAULT_MONTHS);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const { validationErrors, isValidationModalOpen, hideValidationErrors, validateAndProceed } = useValidation();
  const [isWarningToastVisible, setIsWarningToastVisible] = useState(false);

  // Auto-save draft functionality
  useEffect(() => {
    if (id) return; // Only auto-save for new cottages

    const autoSaveInterval = setInterval(() => {
      if (formData.name || formData.description) {
        setIsDraftSaving(true);
        localStorage.setItem('cottage-draft', JSON.stringify(formData));
        setTimeout(() => setIsDraftSaving(false), 1000);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [formData, id]);

  // Load draft on mount
  useEffect(() => {
    if (!id) {
      const draft = localStorage.getItem('cottage-draft');
      if (draft) {
        try {
          const draftData = JSON.parse(draft);
          setFormData(draftData);
          if (draftData.monthlyPricing) {
            setActiveMonths(Object.keys(draftData.monthlyPricing));
          }
        } catch (error) {
          console.error('Error loading draft:', error);
        }
      }
    }
  }, [id]);

  // Load existing cottage data
  useEffect(() => {
    if (id) {
      const fetchCottage = async () => {
        try {
          const cottageDoc = doc(db, 'cottages', id);
          const cottageSnap = await getDoc(cottageDoc);

          if (cottageSnap.exists()) {
            const cottage = cottageSnap.data();

            // Convert old pricing format to new month-based format
            let monthlyPricing = cottage.monthlyPricing || {};
            let activeMonthsList = Object.keys(monthlyPricing);

            // Handle legacy data conversion
            if (cottage.flexiblePricing) {
              monthlyPricing = cottage.flexiblePricing;
              activeMonthsList = Object.keys(cottage.flexiblePricing);
            } else if (cottage.hasSeasonalPricing && cottage.seasonalPricing) {
              // Convert old seasonal pricing to monthly
              const seasonalPricing = cottage.seasonalPricing;
              if (seasonalPricing.winterPrice) {
                monthlyPricing.december = { min: seasonalPricing.winterPrice.toString(), max: seasonalPricing.winterPrice.toString() };
                monthlyPricing.january = { min: seasonalPricing.winterPrice.toString(), max: seasonalPricing.winterPrice.toString() };
                monthlyPricing.february = { min: seasonalPricing.winterPrice.toString(), max: seasonalPricing.winterPrice.toString() };
              }
              if (seasonalPricing.springPrice) {
                monthlyPricing.march = { min: seasonalPricing.springPrice.toString(), max: seasonalPricing.springPrice.toString() };
                monthlyPricing.april = { min: seasonalPricing.springPrice.toString(), max: seasonalPricing.springPrice.toString() };
                monthlyPricing.may = { min: seasonalPricing.springPrice.toString(), max: seasonalPricing.springPrice.toString() };
              }
              if (seasonalPricing.summerPrice) {
                monthlyPricing.june = { min: seasonalPricing.summerPrice.toString(), max: seasonalPricing.summerPrice.toString() };
                monthlyPricing.july = { min: seasonalPricing.summerPrice.toString(), max: seasonalPricing.summerPrice.toString() };
                monthlyPricing.august = { min: seasonalPricing.summerPrice.toString(), max: seasonalPricing.summerPrice.toString() };
              }
              if (seasonalPricing.autumnPrice) {
                monthlyPricing.september = { min: seasonalPricing.autumnPrice.toString(), max: seasonalPricing.autumnPrice.toString() };
                monthlyPricing.october = { min: seasonalPricing.autumnPrice.toString(), max: seasonalPricing.autumnPrice.toString() };
                monthlyPricing.november = { min: seasonalPricing.autumnPrice.toString(), max: seasonalPricing.autumnPrice.toString() };
              }
              activeMonthsList = Object.keys(monthlyPricing);
            }

            // Ensure default months are included if no pricing exists
            if (activeMonthsList.length === 0) {
              activeMonthsList = DEFAULT_MONTHS;
              DEFAULT_MONTHS.forEach(month => {
                monthlyPricing[month] = { min: '', max: '' };
              });
            }

            setFormData({
              name: cottage.name || '',
              description: cottage.description || '',
              location: cottage.location || '',
              pricePerNight: cottage.pricePerNight?.toString() || '',
              maxGuests: cottage.maxGuests?.toString() || '',
              bedrooms: cottage.bedrooms?.toString() || '',
              bathrooms: cottage.bathrooms?.toString() || '',
              extraBeds: cottage.extraBeds?.toString() || '',
              commonAreas: cottage.commonAreas?.toString() || '',
              features: cottage.features?.length > 0 ? cottage.features : [''],
              latitude: cottage.latitude?.toString() || '',
              longitude: cottage.longitude?.toString() || '',
              monthlyPricing,
              amenities: cottage.amenities || {},
              bankInfo: {
                bankName: cottage.bankAccount?.bank || '',
                bankAccount: cottage.bankAccount?.accountNumber || '',
                accountHolderName: cottage.bankAccount?.accountHolderName || ''
              }
            });
            setActiveMonths(activeMonthsList);
            setUploadedImages(cottage.images || []);
            setMainImageIndex(cottage.mainImageIndex || 0);
          }
        } catch (error) {
          console.error('Error fetching cottage:', error);
        }
      };

      fetchCottage();
    }
  }, [id]);

  // Scroll spy for sticky sections
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['basic', 'pricing', 'amenities', 'images', 'location', 'bank'];
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(`section-${section}`);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setStickySection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleFeatureChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = e.target.value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = [...formData.features];
    newFeatures.splice(index, 1);
    setFormData({ ...formData, features: newFeatures });
  };

  const handleAmenityChange = (amenityKey: string) => {
    setFormData({
      ...formData,
      amenities: {
        ...formData.amenities,
        [amenityKey]: !formData.amenities[amenityKey]
      }
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleRemoveUploadedImage = (index: number) => {
    const imageToDelete = uploadedImages[index];
    const updatedImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(updatedImages);

    if (imageToDelete) {
      const imageRef = ref(storage, imageToDelete);
      deleteObject(imageRef).catch((error) => {
        console.error('Error deleting file:', error);
      });
    }
  };

  const handleImageDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedImageIndex !== null && draggedImageIndex !== targetIndex) {
      const newImages = [...uploadedImages];
      const draggedImage = newImages[draggedImageIndex];
      newImages.splice(draggedImageIndex, 1);
      newImages.splice(targetIndex, 0, draggedImage);
      setUploadedImages(newImages);
    }
    setDraggedImageIndex(null);
  };

  const handleMonthlyPricingChange = (month: string, field: 'min' | 'max', value: string) => {
    setFormData({
      ...formData,
      monthlyPricing: {
        ...formData.monthlyPricing,
        [month]: {
          ...formData.monthlyPricing[month],
          [field]: value
        }
      }
    });
  };

  const addMonth = (monthKey: string) => {
    if (!activeMonths.includes(monthKey)) {
      setActiveMonths([...activeMonths, monthKey]);
      setFormData({
        ...formData,
        monthlyPricing: {
          ...formData.monthlyPricing,
          [monthKey]: { min: '', max: '' }
        }
      });
    }
  };

  const removeMonth = (monthKey: string) => {
    setActiveMonths(activeMonths.filter(m => m !== monthKey));
    const updatedPricing = { ...formData.monthlyPricing };
    delete updatedPricing[monthKey];
    setFormData({
      ...formData,
      monthlyPricing: updatedPricing
    });
  };

  const copyPriceFromMonth = (sourceMonth: string, targetMonth: string) => {
    const sourcePrice = formData.monthlyPricing[sourceMonth];
    if (sourcePrice && (sourcePrice.min || sourcePrice.max)) {
      setFormData({
        ...formData,
        monthlyPricing: {
          ...formData.monthlyPricing,
          [targetMonth]: {
            min: sourcePrice.min || '',
            max: sourcePrice.max || ''
          }
        }
      });
    }
  };

  const copyPriceToAll = (sourceMonth: string) => {
    const sourcePrice = formData.monthlyPricing[sourceMonth];
    if (!sourcePrice || (!sourcePrice.min && !sourcePrice.max)) return;

    const updatedPricing = { ...formData.monthlyPricing };
    activeMonths.forEach(month => {
      updatedPricing[month] = {
        min: sourcePrice.min || '',
        max: sourcePrice.max || ''
      };
    });

    setFormData({
      ...formData,
      monthlyPricing: updatedPricing
    });
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    // 1. Basic Information Validation
    if (!formData.name.trim()) newErrors.name = 'კოტეჯის სახელი აუცილებელია';
    if (!formData.description.trim()) newErrors.description = 'აღწერა აუცილებელია';
    if (!formData.location.trim()) newErrors.location = 'მდებარეობა აუცილებელია';
    if (!formData.maxGuests || isNaN(Number(formData.maxGuests)) || Number(formData.maxGuests) <= 0) {
      newErrors.maxGuests = 'სტუმრების რაოდენობა აუცილებელია';
    }

    // 2. Cottage Parameters & Comforts Validation (minimum 7 amenities)
    const selectedAmenities = Object.values(formData.amenities).filter(Boolean).length;
    const customFeatures = formData.features.filter(f => f.trim() !== '').length;
    const totalComfortFeatures = selectedAmenities + customFeatures;

    if (totalComfortFeatures < 7) {
      newErrors.amenities = `მინიმუმ 7 კომფორტი/პარამეტრი უნდა იყოს არჩეული (ამჟამად: ${totalComfortFeatures})`;
    }

    // 3. Images Validation (minimum 5 images)
    const totalImages = uploadedImages.length + images.length;
    if (totalImages < 5) {
      newErrors.images = `მინიმუმ 5 სურათი უნდა იყოს ატვირთული (ამჟამად: ${totalImages})`;
    }

    // 4. Bank Details Validation - განახლებული ლოგიკა
    const hasBankAccountSelected = value?.accountId; // არსებული ანგარიშის ID
    const hasNewBankData = formData.bankInfo.bankName.trim() && 
                          formData.bankInfo.bankAccount.trim() && 
                          formData.bankInfo.accountHolderName.trim();

    if (!hasBankAccountSelected && !hasNewBankData) {
      newErrors.bankAccount = 'ბანკის ანგარიშის არჩევა ან დამატება აუცილებელია';
    } else if (!hasBankAccountSelected && hasNewBankData) {
      // ვალიდაცია ახალი ანგარიშისთვის
      if (!formData.bankInfo.bankName.trim()) {
        newErrors.bankName = 'ბანკის არჩევა აუცილებელია';
      }
      if (!formData.bankInfo.bankAccount.trim()) {
        newErrors.bankAccount = 'ბანკის ანგარიში აუცილებელია';
      } else {
        const ibanValidation = validateIBAN(formData.bankInfo.bankAccount);
        if (!ibanValidation.isValid) {
          newErrors.bankAccount = ibanValidation.message;
        }
      }
      if (!formData.bankInfo.accountHolderName.trim()) {
        newErrors.accountHolderName = 'ანგარიშის მფლობელის სახელი აუცილებელია';
      }
    }

    // 5. Pricing Validation (monthly pricing or base price required)
    const hasAnyMonthlyPricing = activeMonths.some(month => {
      const pricing = formData.monthlyPricing[month];
      return pricing && (pricing.min || pricing.max);
    });

    const hasBasePricing = formData.pricePerNight && 
                          !isNaN(Number(formData.pricePerNight)) && 
                          Number(formData.pricePerNight) > 0;

    if (!hasAnyMonthlyPricing && !hasBasePricing) {
      newErrors.pricing = 'მინიმუმ ერთი თვის ფასი ან ბაზისური ფასი უნდა იყოს მითითებული';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Enhanced form data with additional validation fields
    const validationData = {
      ...formData,
      // Add computed fields for validation
      totalAmenities: Object.values(formData.amenities).filter(Boolean).length + formData.features.filter((f: string) => f.trim() !== '').length,
      totalImages: uploadedImages.length + images.length,
      bankInfo: formData.bankInfo
    };

    const proceedWithSubmission = async () => {
      // Additional cottage-specific validations
      const additionalErrors: string[] = [];

      // Images validation (minimum 5 images)
      const totalImages = uploadedImages.length + images.length;
      if (totalImages < 5) {
        additionalErrors.push(`მინიმუმ 5 სურათი უნდა იყოს ატვირთული (ამჟამად: ${totalImages})`);
      }

      if (additionalErrors.length > 0) {
        setErrors({ images: additionalErrors[0] });
        return;
      }

      setIsSaving(true);

      try {
        const imageUploadPromises = images.map(async (image) => {
          const imageRef = ref(storage, `cottages/${user?.uid}/${image.name}`);
          await uploadBytes(imageRef, image);
          return await getDownloadURL(imageRef);
        });

        const uploadedImageUrls = await Promise.all(imageUploadPromises);
        const allImages = [...uploadedImages, ...uploadedImageUrls];

        // ბანკის ანგარიშის შენახვის ლოგიკა
        let bankAccountId = value?.accountId;
        
        if (!bankAccountId && formData.bankInfo.bankName && formData.bankInfo.bankAccount && formData.bankInfo.accountHolderName) {
          // ახალი ანგარიშის შექმნა
          try {
            bankAccountId = await bankAccountService.addBankAccount({
              bank: formData.bankInfo.bankName,
              accountNumber: formData.bankInfo.bankAccount,
              accountHolderName: formData.bankInfo.accountHolderName,
              accountType: 'personal',
              providerId: user?.uid || '',
              isActive: true
            });
          } catch (error) {
            console.error('Error creating bank account:', error);
            throw new Error('ბანკის ანგარიშის შენახვისას მოხდა შეცდომა');
          }
        }

        const cottageData = {
          name: formData.name,
          description: formData.description,
          location: formData.location,
          pricePerNight: Number(formData.pricePerNight),
          maxGuests: Number(formData.maxGuests),
          bedrooms: Number(formData.bedrooms),
          bathrooms: Number(formData.bathrooms),
          extraBeds: formData.extraBeds ? Number(formData.extraBeds) : 0,
          commonAreas: formData.commonAreas ? Number(formData.commonAreas) : 0,
          images: allImages,
          features: formData.features.filter(f => f.trim() !== ''),
          amenities: formData.amenities,
          providerId: user?.uid,
          providerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          providerEmail: user?.email,
          providerPhone: user?.phoneNumber,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude ? Number(formData.longitude) : undefined,
          monthlyPricing: formData.monthlyPricing,
          activeMonths: activeMonths,
          bankAccountId: bankAccountId,
          // ძველი ფორმატის შენარჩუნება backward compatibility-სთვის
          bankAccount: {
            bank: formData.bankInfo.bankName,
            accountNumber: formData.bankInfo.bankAccount,
            accountHolderName: formData.bankInfo.accountHolderName
          },
          createdAt: id ? undefined : new Date(),
          updatedAt: new Date()
        };

        if (id) {
          const cottageDocRef = doc(db, 'cottages', id);
          await updateDoc(cottageDocRef, cottageData);
        } else {
          const cottagesCollectionRef = collection(db, 'cottages');
          await addDoc(cottagesCollectionRef, cottageData);
          localStorage.removeItem('cottage-draft');
        }

        setIsSaving(false);
        navigate('/admin/cottages');
      } catch (error) {
        console.error('Error saving cottage:', error);
        setIsSaving(false);
      }
    };

    // Use global validation service
    validateAndProceed(validationData, 'cottage', proceedWithSubmission);
  };

  const SectionHeader = ({ 
    title, 
    icon: Icon, 
    sectionKey, 
    required = false 
  }: { 
    title: string; 
    icon: any; 
    sectionKey: keyof typeof expandedSections;
    required?: boolean;
  }) => {
    const getSectionErrors = () => {
      switch (sectionKey) {
        case 'basic':
          return [errors.name, errors.description, errors.location, errors.maxGuests].filter(Boolean);
        case 'amenities':
          return [errors.amenities].filter(Boolean);
        case 'images':
          return [errors.images].filter(Boolean);
        case 'bank':
          return [errors.bankName, errors.bankAccount, errors.accountHolderName].filter(Boolean);
        case 'pricing':
          return [errors.pricing].filter(Boolean);
        default:
          return [];
      }
    };

    const sectionErrors = getSectionErrors();
    const hasErrors = sectionErrors.length > 0;

    return (
    <div 
      className={`sticky top-0 z-30 bg-white dark:bg-gray-800 border-b transition-all duration-200 ${
        hasErrors 
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' 
          : stickySection === sectionKey 
            ? 'shadow-lg border-blue-200 dark:border-blue-700' 
            : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <motion.button
        type="button"
        onClick={() => toggleSection(sectionKey)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        whileHover={{ scale: 1.001 }}
        whileTap={{ scale: 0.999 }}
      >
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-xl shadow-lg">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
              {required && <span className="text-red-500 ml-1">*</span>}
            </h3>
            {stickySection === sectionKey && (
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">მიმდინარე სექცია</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {hasErrors && (
            <div className="flex items-center text-red-500">
              <AlertCircle className="w-5 h-5 mr-1" />
              <span className="text-sm font-medium">{sectionErrors.length} შეცდომა</span>
            </div>
          )}
          {!hasErrors && sectionKey !== 'location' && (
            <div className="flex items-center text-green-500">
              <CheckCircle className="w-5 h-5 mr-1" />
              <span className="text-sm font-medium">სრული</span>
            </div>
          )}
          {expandedSections[sectionKey] ? (
            <ChevronUp className="w-6 h-6 text-gray-400" />
          ) : (
            <ChevronDown className="w-6 h-6 text-gray-400" />
          )}
        </div>
      </motion.button>
    </div>
  );
  };

  const getAvailableMonths = () => {
    return ALL_MONTHS.filter(month => !activeMonths.includes(month.key));
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header with Back Button */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="mb-6 lg:mb-0">
                <div className="flex items-center mb-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/admin/cottages')}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 p-3 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 mr-4 transition-all duration-300 flex items-center"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    <span className="font-semibold">უკან კოტეჯებზე</span>
                  </motion.button>
                </div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center mb-2">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-3 rounded-2xl mr-4 shadow-lg">
                    <Home className="w-8 h-8 text-white" />
                  </div>
                  {id ? 'კოტეჯის განახლება' : 'ახალი კოტეჯი'}
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {id ? 'განაახლეთ კოტეჯის ინფორმაცია' : 'დაამატეთ ახალი კოტეჯი სისტემაში'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {isDraftSaving && (
                  <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-2 rounded-xl shadow-md">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent mr-2"></div>
                    ავტომატური შენახვა...
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleDarkMode}
                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-4 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg"
                >
                  {isDarkMode ? <Sun className="w-5 h-5 mr-2" /> : <Moon className="w-5 h-5 mr-2" />}
                  {isDarkMode ? 'ნათელი რეჟიმი' : 'მუქი რეჟიმი'}
                </motion.button>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">

              {/* Basic Information Section */}
              <div id="section-basic">
                <SectionHeader 
                  title="ძირითადი ინფორმაცია" 
                  icon={Info} 
                  sectionKey="basic" 
                  required 
                />

                <AnimatePresence>
                  {expandedSections.basic && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 space-y-6">

                        {/* Name */}
                        <div>
                          <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            კოტეჯის სახელი *
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              id="name"
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg ${
                                errors.name ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-red-100' : 'border-gray-200 dark:border-gray-600'
                              }`}
                              placeholder="მაგ. ბახმაროს საოცნებო კოტეჯი"
                            />
                            {errors.name && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              </div>
                            )}
                          </div>
                          {errors.name && (
                            <motion.p
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center"
                            >
                              <AlertCircle className="w-4 h-4 mr-1" />
                              {errors.name}
                            </motion.p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label htmlFor="description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            აღწერა *
                          </label>
                          <div className="relative">
                            <textarea
                              id="description"
                              name="description"
                              value={formData.description}
                              onChange={handleChange}
                              rows={5}
                              className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none ${
                                errors.description ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
                              }`}
                              placeholder="აღწერეთ თქვენი კოტეჯი, მისი უპირატესობები და განსაკუთრებულობები..."
                            />
                            {errors.description && (
                              <div className="absolute right-3 top-4">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              </div>
                            )}
                          </div>
                          {errors.description && (
                            <motion.p
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center"
                            >
                              <AlertCircle className="w-4 h-4 mr-1" />
                              {errors.description}
                            </motion.p>
                          )}
                        </div>

                        {/* Location */}
                        <div>
                          <label htmlFor="location" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            მდებარეობა *
                          </label>
                          <div className="relative">
                            <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                              type="text"
                              id="location"
                              name="location"
                              value={formData.location}
                              onChange={handleChange}
                              className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                                errors.location ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
                              }`}
                              placeholder="მაგ. ბახმარო, აჭარა"
                            />
                            {errors.location && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              </div>
                            )}
                          </div>
                          {errors.location && (
                            <motion.p
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center"
                            >
                              <AlertCircle className="w-4 h-4 mr-1" />
                              {errors.location}
                            </motion.p>
                          )}
                        </div>

                        {/* Cottage Capacity Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {[
                            { key: 'pricePerNight', label: 'ბაზისური ფასი ღამეში (₾)', icon: DollarSign, placeholder: '150' },
                            { key: 'maxGuests', label: 'დასასვენებელი ადგილი (სტუმრები)', icon: Users, placeholder: '4' },
                            { key: 'bedrooms', label: 'საძინებელი ოთახები', icon: Bed, placeholder: '2' },
                            { key: 'bathrooms', label: 'სააბაზანოები', icon: Bath, placeholder: '1' },
                            { key: 'extraBeds', label: 'დამატებითი საწოლები', icon: Bed, placeholder: '0' },
                            { key: 'commonAreas', label: 'საერთო სივრცე', icon: Sofa, placeholder: '1' }
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                {field.label} {field.key === 'pricePerNight' || field.key === 'maxGuests' || field.key === 'bedrooms' || field.key === 'bathrooms' ? '*' : ''}
                              </label>
                              <div className="relative">
                                <field.icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                  type="number"
                                  name={field.key}
                                  value={formData[field.key as keyof typeof formData] as string}
                                  onChange={handleChange}
                                  min="0"
                                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                                    errors[field.key] ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
                                  }`}
                                  placeholder={field.placeholder}
                                />
                                {errors[field.key] && (
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                  </div>
                                )}
                              </div>
                              {errors[field.key] && (
                                <motion.p
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-1 text-xs text-red-600 dark:text-red-400"
                                >
                                  {errors[field.key]}
                                </motion.p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Month-Based Pricing Section */}
              <div id="section-pricing">
                <SectionHeader 
                  title="თვიური ფასების მართვა" 
                  icon={Calendar} 
                  sectionKey="pricing" 
                  required
                />

                <AnimatePresence>
                  {expandedSections.pricing && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 space-y-8">

                        {/* Info Box */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start space-x-4">
                            <div className="bg-blue-600 p-3 rounded-xl shadow-lg">
                              <Calendar className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2">თვიური ფასების სისტემა</h4>
                              <p className="text-blue-700 dark:text-blue-300 mb-3">
                                აქ განსაზღვრეთ თითოეული თვის მინიმალური და მაქსიმალური ფასები. კოტეჯი ხელმისაწვდომია მხოლოდ იმ თვეებში, რომლებშიც ფასები არის განსაზღვრული.
                              </p>
                              <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                                <p>🗓️ რეკომენდებული თვეები: ივნისი, ივლისი, აგვისტო</p>
                                <p>➕ ნებისმიერი თვე შეგიძლიათ დაამატოთ ქვემოთ</p>
                                <p>💰 თუ არცერთი თვე არ არის აქტიური = ბაზისური ფასი მოქმედებს</p>
                                <p>❌ არაფენებული თვეები = კოტეჯი დაკეტილია იმ თვეებში</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Active Months Pricing */}
                        <div>
                          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                            <Calendar className="w-6 h-6 mr-3 text-green-600" />
                            ფასები გაქტიურებული თვეებისთვის ({activeMonths.length} თვე)
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeMonths.map((monthKey) => {
                              const month = ALL_MONTHS.find(m => m.key === monthKey);
                              if (!month) return null;

                              const pricing = formData.monthlyPricing[monthKey] || { min: '', max: '' };
                              const isDefaultMonth = DEFAULT_MONTHS.includes(monthKey);

                              return (
                                <motion.div
                                  key={monthKey}
                                  layout
                                  className="bg-white dark:bg-gray-700 p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl transition-all duration-300"
                                >
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                      <span className="text-2xl">{month.emoji}</span>
                                      <h5 className="font-bold text-gray-900 dark:text-white text-lg">{month.label}</h5>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {/* Copy buttons */}
                                      <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => copyPriceToAll(monthKey)}
                                        className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                        title="კოპირება ყველა თვეში"
                                      >
                                        <Copy className="w-4 h-4" />
                                      </motion.button>

                                      {/* Remove button for all months */}
                                      <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => removeMonth(monthKey)}
                                        className="p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                        title="თვის წაშლა"
                                      >
                                        <X className="w-4 h-4" />
                                      </motion.button>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                        მინ. ფასი (₾ ღამეში)
                                      </label>
                                      <input
                                        type="number"
                                        value={pricing.min}
                                        onChange={(e) => handleMonthlyPricingChange(monthKey, 'min', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all"
                                        placeholder="მაგ. 120"
                                        min="1"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                        მაქს. ფასი (₾ ღამეში)
                                      </label>
                                      <input
                                        type="number"
                                        value={pricing.max}
                                        onChange={(e) => handleMonthlyPricingChange(monthKey, 'max', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all"
                                        placeholder="მაგ. 200"
                                        min="1"
                                      />
                                    </div>
                                  </div>

                                  {isDefaultMonth && (
                                    <div className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center">
                                      <Star className="w-3 h-3 mr-1" />
                                      რეკომენდებული
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Add New Months Section */}
                        {getAvailableMonths().length > 0 && (
                          <div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                              <Plus className="w-6 h-6 mr-3 text-blue-600" />
                              დამატებითი თვეების დაამატება
                            </h4>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {getAvailableMonths().map((month) => (
                                <motion.button
                                  key={month.key}
                                  type="button"
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => addMonth(month.key)}
                                  className="p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl transition-all duration-300 flex flex-col items-center space-y-2"
                                >
                                  <span className="text-2xl">{month.emoji}</span>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{month.label}</span>
                                  <Plus className="w-4 h-4 text-gray-400" />
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Base Price Priority Notice */}
                        {activeMonths.length === 0 && (
                          <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6">
                            <div className="flex items-start space-x-4">
                              <div className="bg-green-600 p-3 rounded-xl shadow-lg">
                                <CreditCard className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <h4 className="text-lg font-bold text-green-800 dark:text-green-200 mb-2">ბაზისური ფასი აქტიურია</h4>
                                <p className="text-green-700 dark:text-green-300 mb-3">
                                  თვიური ფასები არ არის განსაზღვრული, ამიტომ მოქმედებს ბაზისური ფასი: <strong>{formData.pricePerNight}₾</strong> ღამეში
                                </p>
                                <div className="text-sm text-green-600 dark:text-green-400">
                                  <p>✅ კოტეჯი ხელმისაწვდომია მთელი წლის განმავლობაში</p>
                                  <p>💰 ერთიანი ფასი ყველა სეზონისთვის</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pricing Validation Error */}
                        {errors.pricing && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4"
                          >
                            <div className="flex items-center text-red-700 dark:text-red-300">
                              <AlertCircle className="w-5 h-5 mr-3" />
                              <span className="font-medium">{errors.pricing}</span>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Amenities Section */}
              <div id="section-amenities">
                <SectionHeader 
                  title="კოტეჯის პარამეტრები და კომფორტი" 
                  icon={Home} 
                  sectionKey="amenities" 
                />

                <AnimatePresence>
                  {expandedSections.amenities && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-8">
                        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl transition-all ${
                          errors.amenities ? 'border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' : ''
                        }`}>
                          {errors.amenities && (
                            <div className="col-span-full mb-4 flex items-center text-red-600 dark:text-red-400">
                              <AlertCircle className="w-5 h-5 mr-2" />
                              <span className="font-medium">{errors.amenities}</span>
                            </div>
                          )}
                          {COTTAGE_AMENITIES.map((amenity) => (
                            <motion.label
                              key={amenity.key}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                                formData.amenities[amenity.key]
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-sm'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.amenities[amenity.key] || false}
                                onChange={() => handleAmenityChange(amenity.key)}
                                className="sr-only"
                              />
                              <div className={`flex items-center justify-center w-8 h-8 rounded-lg mr-3 transition-colors ${
                                formData.amenities[amenity.key]
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                              }`}>
                                <amenity.icon className="w-4 h-4" />
                              </div>
                              <span className={`font-medium transition-colors ${
                                formData.amenities[amenity.key]
                                  ? 'text-blue-800 dark:text-blue-200'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {amenity.label}
                              </span>
                              {formData.amenities[amenity.key] && (
                                <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                              )}
                            </motion.label>
                          ))}
                        </div>

                        {/* Additional Features */}
                        <div className="mt-8">
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">დამატებითი პარამეტრები</h4>
                          <div className="space-y-4">
                            {formData.features.map((feature, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex items-center gap-3"
                              >
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                  <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <input
                                  type="text"
                                  value={feature}
                                  onChange={(e) => handleFeatureChange(e, index)}
                                  className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="მაგ. განსაკუთრებული ხედი, ბავშვებისთვის უსაფრთხო, ეკო-მეგობრული"
                                />
                                <motion.button
                                  type="button"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeFeature(index)}
                                  className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </motion.button>
                              </motion.div>
                            ))}

                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={addFeature}
                              className="w-full flex items-center justify-center px-6 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors bg-gray-50 dark:bg-gray-700/50"
                            >
                              <Plus className="w-5 h-5 mr-2" />
                              ახალი პარამეტრის დამატება
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Images Section */}
              <div id="section-images">
                <SectionHeader 
                  title="სურათების მართვა" 
                  icon={Upload} 
                  sectionKey="images" 
                />

                <AnimatePresence>
                  {expandedSections.images && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 space-y-8">

                        {/* Enhanced Upload Area */}
                        <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 ${
                          errors.images 
                            ? 'border-red-300 dark:border-red-700 hover:border-red-400 bg-red-50 dark:bg-red-900/10' 
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
                        }`}>
                          {errors.images && (
                            <div className="mb-4 flex items-center justify-center text-red-600 dark:text-red-400">
                              <AlertCircle className="w-5 h-5 mr-2" />
                              <span className="font-medium">{errors.images}</span>
                            </div>
                          )}
                          <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-3">
                            სურათების ატვირთვა
                          </p>
                          <p className="text-gray-500 dark:text-gray-500 mb-6">
                            ჩააგდეთ ფაილები აქ ან დააკლიკეთ ასარჩევად
                          </p>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="image-upload"
                          />
                          <label
                            htmlFor="image-upload"
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold cursor-pointer transition-all inline-block shadow-lg"
                          >
                            ფაილების არჩევა
                          </label>
                        </div>

                        {/* Existing Images with Drag & Drop */}
                        {uploadedImages.length > 0 && (
                          <div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                              <Star className="w-5 h-5 mr-2 text-yellow-500" />
                              ატვირთული სურათები ({uploadedImages.length})
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                              {uploadedImages.map((image, index) => (
                                <motion.div
                                  key={index}
                                  layout
                                  className="relative group rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 aspect-square shadow-lg"
                                  draggable
                                  onDragStart={() => setDraggedImageIndex(index)}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => handleImageDrop(e, index)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <img
                                    src={image}
                                    alt={`კოტეჯის სურათი ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                      <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setMainImageIndex(index)}
                                        className="bg-yellow-600 text-white p-2 rounded-full transition-all"
                                      >
                                        <Star className="w-4 h-4" />
                                      </motion.button>
                                      <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleRemoveUploadedImage(index)}
                                        className="bg-red-600 text-white p-2 rounded-full transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </motion.button>
                                    </div>
                                  </div>
                                  <div className="absolute top-2 left-2 cursor-move">
                                    <GripVertical className="w-5 h-5 text-white drop-shadow-lg" />
                                  </div>
                                  {index === mainImageIndex && (
                                    <div className="absolute bottom-2 left-2 bg-yellow-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg">
                                      <Star className="w-3 h-3 inline mr-1" />
                                      მთავარი
                                    </div>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* New Images Preview */}
                        {images.length > 0 && (
                          <div>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                              <Plus className="w-5 h-5 mr-2 text-green-500" />
                              ახალი სურათები ({images.length})
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                              {images.map((image, index) => (
                                <div key={index} className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-700 aspect-square shadow-lg">
                                  This change adds a WarningToast component with props to the CottageForm.                                  <img
                                    src={URL.createObjectURL(image)}
                                    alt={`ახალი სურათი ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                                    <CheckCircle className="w-3 h-3 inline mr-1" />
                                    ახალი
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Location Section */}
              <div id="section-location">
                <SectionHeader 
                  title="მდებარეობის კოორდინატები" 
                  icon={MapPin} 
                  sectionKey="location" 
                />

                <AnimatePresence>
                  {expandedSections.location && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-8">                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label htmlFor="latitude" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                              Latitude (განედი)
                            </label>
                            <input
                              type="number"
                              id="latitude"
                              name="latitude"
                              value={formData.latitude}
                              onChange={handleChange}
                              step="any"
                              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="მაგ. 41.6168"
                            />
                          </div>
                          <div>
                            <label htmlFor="longitude" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                              Longitude (გრძედი)
                            </label>
                            <input
                              type="number"
                              id="longitude"
                              name="longitude"
                              value={formData.longitude}
                              onChange={handleChange}
                              step="any"
                              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="მაგ. 41.6367"
                            />
                          </div>
                        </div>
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
                            <Info className="w-4 h-4 mr-2" />
                            კოორდინატების მითითება გაუადვილებს სტუმრებს თქვენი კოტეჯის პოვნას რუკაზე.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bank Account Section */}
              <div id="section-bank">
                <SectionHeader 
                  title="ბანკის ანგარიში" 
                  icon={CreditCard} 
                  sectionKey="bank" 
                  required
                />

                <AnimatePresence>
                  {expandedSections.bank && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-8 space-y-8">
                        <BankAccountField
                          value={formData.bankInfo ? {
                            bank: formData.bankInfo.bankName,
                            accountNumber: formData.bankInfo.bankAccount,
                            accountHolderName: formData.bankInfo.accountHolderName
                          } : undefined}
                          onChange={(value) => {
                            if (value) {
                              setFormData({
                                ...formData,
                                bankInfo: {
                                  bankName: value.bank,
                                  bankAccount: value.accountNumber,
                                  accountHolderName: value.accountHolderName
                                }
                              });
                            } else {
                              setFormData({
                                ...formData,
                                bankInfo: {
                                  bankName: '',
                                  bankAccount: '',
                                  accountHolderName: ''
                                }
                              });
                            }
                          }}
                          required={true}
                          showAccountChoice={true}
                        />

                        {/* Bank Account Validation Errors */}
                        {(errors.bankName || errors.bankAccount || errors.accountHolderName) && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-4"
                          >
                            <div className="flex items-center text-red-700 dark:text-red-300 mb-3">
                              <AlertTriangle className="w-5 h-5 mr-3" />
                              <span className="font-medium">ბანკის ანგარიშის ინფორმაციაში შეცდომები:</span>
                            </div>
                            <div className="space-y-2 text-sm text-red-600 dark:text-red-400">
                              {errors.bankName && <p>• {errors.bankName}</p>}
                              {errors.bankAccount && <p>• {errors.bankAccount}</p>}
                              {errors.accountHolderName && <p>• {errors.accountHolderName}</p>}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-end">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/admin/cottages')}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-8 py-4 rounded-2xl font-bold transition-all shadow-lg border-2 border-gray-200 dark:border-gray-700"
              >
                გაუქმება
              </motion.button>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isSaving}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center min-w-[200px]"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    იტვირთება...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-3" />
                    {id ? 'განახლება' : 'შენახვა'}
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </div>

        {/* Warning Toast */}
        <WarningToast
          isVisible={isValidationModalOpen}
          onClose={hideValidationErrors}
          messages={validationErrors}
          title="ფორმის შევსება დაუსრულებელია"
          type="warning"
          position="center"
          autoClose={false}
        />
      </div>
    </div>
  );
};

export default CottageForm;