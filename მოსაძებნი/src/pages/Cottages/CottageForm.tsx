import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, addDoc, collection, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
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
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useDarkMode } from '../../hooks/useDarkMode';
import BankAccountField from '../../components/BankAccountField';
import WarningToast from '../../components/WarningToast';

interface FormData {
  name: string;
  description: string;
  location: string;
  pricePerNight: string;
  maxGuests: string;
  bedrooms: string;
  bathrooms: string;
  features: string[];
  latitude: string;
  longitude: string;
  hasSeasonalPricing: boolean;
  pricingMode: 'standard' | 'flexible';
  winterPrice: string;
  springPrice: string;
  summerPrice: string;
  autumnPrice: string;
  bankInfo: {
    bankName: string;
    bankAccount: string;
    accountHolderName: string;
  };
}

interface SavedBankAccount {
  id: string;
  bank: string;
  accountNumber: string;
  accountHolderName: string;
}

const CottageForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    location: '',
    pricePerNight: '',
    maxGuests: '',
    bedrooms: '',
    bathrooms: '',
    features: [''],
    latitude: '',
    longitude: '',
    hasSeasonalPricing: false,
    pricingMode: 'standard',
    winterPrice: '',
    springPrice: '',
    summerPrice: '',
    autumnPrice: '',
    bankInfo: {
      bankName: '',
      bankAccount: '',
      accountHolderName: ''
    }
  });

  const [bankAccountData, setBankAccountData] = useState<{
    bank: string;
    accountNumber: string;
    accountHolderName: string;
    sharedBankAccountId?: string;
  } | undefined>(undefined);

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
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [savedBankAccounts, setSavedBankAccounts] = useState<SavedBankAccount[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [showManualBankEntry, setShowManualBankEntry] = useState(false);
  const [isWarningToastVisible, setIsWarningToastVisible] = useState(false);

  // Load saved bank accounts from admin panel
  useEffect(() => {
    const loadSavedBankAccounts = async () => {
      if (!user?.id) return;

      try {
        // Get bank accounts from admin panel
        const bankAccountsQuery = query(
          collection(db, 'bankAccounts'),
          where('isActive', '==', true)
        );
        const bankAccountsSnapshot = await getDocs(bankAccountsQuery);

        const bankAccountsList: SavedBankAccount[] = [];

        bankAccountsSnapshot.docs.forEach(doc => {
          const account = doc.data();
          bankAccountsList.push({
            id: doc.id,
            bank: account.bank || '',
            accountNumber: account.accountNumber || '',
            accountHolderName: account.accountHolderName || ''
          });
        });

        setSavedBankAccounts(bankAccountsList);
      } catch (error) {
        console.error('Error loading saved bank accounts:', error);
      }
    };

    loadSavedBankAccounts();
  }, [user?.id]);

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

            setFormData({
              name: cottage.name || '',
              description: cottage.description || '',
              location: cottage.location || '',
              pricePerNight: cottage.pricePerNight?.toString() || '',
              maxGuests: cottage.maxGuests?.toString() || '',
              bedrooms: cottage.bedrooms?.toString() || '',
              bathrooms: cottage.bathrooms?.toString() || '',
              features: cottage.features?.length > 0 ? cottage.features : [''],
              latitude: cottage.latitude?.toString() || '',
              longitude: cottage.longitude?.toString() || '',
              hasSeasonalPricing: cottage.hasSeasonalPricing || false,
              pricingMode: cottage.pricingMode || 'standard',
              winterPrice: cottage.seasonalPricing?.winterPrice?.toString() || '',
              springPrice: cottage.seasonalPricing?.springPrice?.toString() || '',
              summerPrice: cottage.seasonalPricing?.summerPrice?.toString() || '',
              autumnPrice: cottage.seasonalPricing?.autumnPrice?.toString() || '',
              bankInfo: {
                bankName: cottage.bankAccount?.bank || '',
                bankAccount: cottage.bankAccount?.accountNumber || '',
                accountHolderName: cottage.bankAccount?.accountHolderName || ''
              }
            });

            // ბანკის ანგარიშის მონაცემების დაყენება
            if (cottage.sharedBankAccountId) {
              setBankAccountData({
                bank: cottage.bankAccount?.bank || '',
                accountNumber: cottage.bankAccount?.accountNumber || '',
                accountHolderName: cottage.bankAccount?.accountHolderName || '',
                sharedBankAccountId: cottage.sharedBankAccountId
              });
            } else if (cottage.bankAccount) {
              setBankAccountData({
                bank: cottage.bankAccount.bank,
                accountNumber: cottage.bankAccount.accountNumber,
                accountHolderName: cottage.bankAccount.accountHolderName
              });
            }
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

  const handleBankAccountSelect = (accountId: string) => {
    if (accountId === 'manual') {
      setShowManualBankEntry(true);
      setSelectedBankAccount('');
      setFormData({
        ...formData,
        bankInfo: {
          bankName: '',
          bankAccount: '',
          accountHolderName: ''
        }
      });
    } else if (accountId === '') {
      setSelectedBankAccount('');
      setShowManualBankEntry(false);
      setFormData({
        ...formData,
        bankInfo: {
          bankName: '',
          bankAccount: '',
          accountHolderName: ''
        }
      });
    } else {
      const account = savedBankAccounts.find(acc => acc.id === accountId);
      if (account) {
        setSelectedBankAccount(accountId);
        setShowManualBankEntry(false);
        setFormData({
          ...formData,
          bankInfo: {
            bankName: account.bank,
            bankAccount: account.accountNumber,
            accountHolderName: account.accountHolderName
          }
        });
      }
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    // 1. Basic Information Validation
    if (!formData.name.trim()) {
      newErrors.name = 'კოტეჯის სახელი აუცილებელია';
    } else if (formData.name.trim().length < 5) {
      newErrors.name = 'კოტეჯის სახელი უნდა იყოს მინიმუმ 5 სიმბოლო';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'აღწერა აუცილებელია';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'აღწერა უნდა იყოს მინიმუმ 10 სიმბოლო';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'მდებარეობა აუცილებელია';
    } else if (formData.location.trim().length < 5) {
      newErrors.location = 'მდებარეობა უნდა იყოს მინიმუმ 5 სიმბოლო';
    }

    if (!formData.maxGuests || isNaN(Number(formData.maxGuests)) || Number(formData.maxGuests) <= 0) {
      newErrors.maxGuests = 'სტუმრების რაოდენობა აუცილებელია და უნდა იყოს დადებითი რიცხვი';
    }

    // Basic numbers validation
    if (!formData.bedrooms || isNaN(Number(formData.bedrooms)) || Number(formData.bedrooms) <= 0) {
      newErrors.bedrooms = 'საძინებლების რაოდენობა აუცილებელია';
    }

    if (!formData.bathrooms || isNaN(Number(formData.bathrooms)) || Number(formData.bathrooms) <= 0) {
      newErrors.bathrooms = 'სააბაზანოების რაოდენობა აუცილებელია';
    }

    // 2. Cottage Parameters & Comforts Validation (minimum 3 features)
    const customFeatures = formData.features.filter(f => f.trim() !== '').length;
    if (customFeatures < 3) {
      newErrors.amenities = `მინიმუმ 3 კომფორტი/პარამეტრი უნდა იყოს დამატებული (ამჟამად: ${customFeatures})`;
    }

    // 3. Images Validation (minimum 5 images)
    const totalImages = uploadedImages.length + images.length;
    if (totalImages < 5) {
      newErrors.images = `მინიმუმ 5 სურათი უნდა იყოს ატვირთული (ამჟამად: ${totalImages})`;
    }

    // 4. Bank Details Validation
    if (!bankAccountData) {
      newErrors.bankAccount = 'ბანკის ანგარიშის არჩევა აუცილებელია';
    } else {
      if (!bankAccountData.bank.trim()) {
        newErrors.bankName = 'ბანკის არჩევა აუცილებელია';
      }

      if (!bankAccountData.accountNumber.trim()) {
        newErrors.bankAccount = 'ბანკის ანგარიში აუცილებელია';
      } else {
        // IBAN validation - must start with GE and be exactly 22 characters
        const iban = bankAccountData.accountNumber.trim().toUpperCase();
        if (!iban.startsWith('GE')) {
          newErrors.bankAccount = 'ქართული IBAN უნდა იწყებოდეს GE-თი';
        } else if (iban.length !== 22) {
          newErrors.bankAccount = 'ქართული IBAN უნდა იყოს ზუსტად 22 სიმბოლო';
        } else if (!/^GE\d{2}[A-Z0-9]{18}$/.test(iban)) {
          newErrors.bankAccount = 'IBAN ფორმატი არასწორია (GE + 2 ციფრი + 18 სიმბოლო)';
        }
      }

      if (!bankAccountData.accountHolderName.trim()) {
        newErrors.accountHolderName = 'ანგარიშის მფლობელის სახელი აუცილებელია';
      } else if (bankAccountData.accountHolderName.trim().length < 5) {
        newErrors.accountHolderName = 'ანგარიშის მფლობელის სახელი უნდა იყოს მინიმუმ 5 სიმბოლო';
      }
    }

    // 5. Pricing Validation (at least base price required)
    const hasBasePricing = formData.pricePerNight && 
                          !isNaN(Number(formData.pricePerNight)) && 
                          Number(formData.pricePerNight) > 0;

    const hasSeasonalPricing = formData.hasSeasonalPricing && (
      (formData.winterPrice && !isNaN(Number(formData.winterPrice)) && Number(formData.winterPrice) > 0) ||
      (formData.springPrice && !isNaN(Number(formData.springPrice)) && Number(formData.springPrice) > 0) ||
      (formData.summerPrice && !isNaN(Number(formData.summerPrice)) && Number(formData.summerPrice) > 0) ||
      (formData.autumnPrice && !isNaN(Number(formData.autumnPrice)) && Number(formData.autumnPrice) > 0)
    );

    if (!hasBasePricing && !hasSeasonalPricing) {
      newErrors.pricing = 'მინიმუმ ბაზისური ფასი ან სეზონური ფასი უნდა იყოს მითითებული';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSeasonalPricingToggle = (enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      hasSeasonalPricing: enabled,
      winterPrice: enabled ? prev.winterPrice : '',
      springPrice: enabled ? prev.springPrice : '',
      summerPrice: enabled ? prev.summerPrice : '',
      autumnPrice: enabled ? prev.autumnPrice : ''
    }));
  };

  const copyPriceToAll = (sourcePrice: string) => {
    if (!sourcePrice || isNaN(Number(sourcePrice))) return;

    setFormData(prev => ({
      ...prev,
      winterPrice: sourcePrice,
      springPrice: sourcePrice,
      summerPrice: sourcePrice,
      autumnPrice: sourcePrice
    }));
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

    // Validate form first
    const isValid = validateForm();
    
    if (!isValid) {
      // Show validation toast with all errors
      const errorMessages = Object.values(errors).filter(Boolean);
      if (errorMessages.length > 0) {
        setIsWarningToastVisible(true);
        setTimeout(() => setIsWarningToastVisible(false), 8000);
      }
      return;
    }

    // Enhanced form data with additional validation fields
    const validationData = {
      ...formData,
      // Add computed fields for validation
      totalAmenities: formData.features.filter((f: string) => f.trim() !== '').length,
      totalImages: uploadedImages.length + images.length,
      bankInfo: formData.bankInfo
    };

    const proceedWithSubmission = async () => {
      setIsSaving(true);

    try {
      let cottageId: string;
      let uploadedImageUrls: string[] = [];

      console.log('📝 Form data:', formData);
      console.log('🖼️ Images to upload:', images.length);
      console.log('🔗 Existing images:', uploadedImages.length);

      // Step 1: For new cottages, create a temporary cottage first to get an ID
      if (!id) {
        console.log('🆕 Creating new cottage...');
        const tempCottageData = {
          name: formData.name,
          description: formData.description,
          location: formData.location,
          pricePerNight: Number(formData.pricePerNight),
          maxGuests: Number(formData.maxGuests),
          bedrooms: Number(formData.bedrooms),
          bathrooms: Number(formData.bathrooms),
          images: [], // Empty initially
          features: formData.features.filter(f => f.trim() !== ''),
          providerId: user?.id,
          providerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          providerEmail: user?.email,
          providerPhone: user?.phoneNumber,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude ? Number(formData.longitude) : undefined,
          hasSeasonalPricing: formData.hasSeasonalPricing,
          pricingMode: formData.pricingMode,
          seasonalPricing: formData.hasSeasonalPricing ? {
            winterPrice: formData.winterPrice ? Number(formData.winterPrice) : undefined,
            springPrice: formData.springPrice ? Number(formData.springPrice) : undefined,
            summerPrice: formData.summerPrice ? Number(formData.summerPrice) : undefined,
            autumnPrice: formData.autumnPrice ? Number(formData.autumnPrice) : undefined
          } : undefined,
          bankAccount: {
            bank: formData.bankInfo.bankName,
            accountNumber: formData.bankInfo.bankAccount,
            accountHolderName: formData.bankInfo.accountHolderName,
            accountId: selectedBankAccount && selectedBankAccount !== 'manual' ? selectedBankAccount : undefined
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const cottagesCollectionRef = collection(db, 'cottages');
        const docRef = await addDoc(cottagesCollectionRef, tempCottageData);
        cottageId = docRef.id;
        console.log('✅ Cottage created with ID:', cottageId);
        localStorage.removeItem('cottage-draft');
      } else {
        cottageId = id;
        console.log('✏️ Updating existing cottage with ID:', cottageId);
      }

      // Step 2: Upload new images if any, using the cottage ID
      if (images.length > 0) {
        console.log('🔄 Starting image upload process for', images.length, 'images...');
        const imageUploadPromises = images.map(async (image, index) => {
          const imagePath = `cottages/${cottageId}/${Date.now()}_${image.name}`;
          console.log(`📤 Uploading image ${index + 1}/${images.length}:`, imagePath);
          const imageRef = ref(storage, imagePath);
          await uploadBytes(imageRef, image);
          const downloadUrl = await getDownloadURL(imageRef);
          console.log(`✅ Image ${index + 1} uploaded successfully:`, downloadUrl);
          return downloadUrl;
        });

        uploadedImageUrls = await Promise.all(imageUploadPromises);
        console.log('✅ All images uploaded successfully:', uploadedImageUrls);
      }

      // Step 3: Prepare final cottage data
      const allImages = [...uploadedImages, ...uploadedImageUrls];
      console.log('🖼️ Total images for cottage:', allImages.length);

      const finalCottageData = {
        name: formData.name,
        description: formData.description,
        location: formData.location,
        pricePerNight: Number(formData.pricePerNight),
        maxGuests: Number(formData.maxGuests),
        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        images: allImages,
        mainImageIndex: Math.min(mainImageIndex, allImages.length - 1),
        features: formData.features.filter(f => f.trim() !== ''),
        providerId: user?.id,
        providerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        providerEmail: user?.email,
        providerPhone: user?.phoneNumber,
        latitude: formData.latitude ? Number(formData.latitude) : undefined,
        longitude: formData.longitude ? Number(formData.longitude) : undefined,
        hasSeasonalPricing: formData.hasSeasonalPricing,
        pricingMode: formData.pricingMode,
        seasonalPricing: formData.hasSeasonalPricing ? {
          winterPrice: formData.winterPrice ? Number(formData.winterPrice) : undefined,
          springPrice: formData.springPrice ? Number(formData.springPrice) : undefined,
          summerPrice: formData.summerPrice ? Number(formData.summerPrice) : undefined,
          autumnPrice: formData.autumnPrice ? Number(formData.autumnPrice) : undefined
        } : undefined,
        // ბანკის ანგარიშის მონაცემები
        ...(bankAccountData?.sharedBankAccountId ? {
          sharedBankAccountId: bankAccountData.sharedBankAccountId,
          bankAccount: {
            bank: bankAccountData.bank,
            accountNumber: bankAccountData.accountNumber,
            accountHolderName: bankAccountData.accountHolderName
          }
        } : {
          individualBankAccount: {
            bank: bankAccountData?.bank || '',
            accountNumber: bankAccountData?.accountNumber || '',
            accountHolderName: bankAccountData?.accountHolderName || ''
          }
        }),
        updatedAt: new Date()
      };

      // Step 4: Update cottage with final data
      console.log('💾 Updating cottage with final data...');
      console.log('📊 Final cottage data:', finalCottageData);

      const cottageDocRef = doc(db, 'cottages', cottageId);
      await updateDoc(cottageDocRef, finalCottageData);

      console.log('✅ Cottage saved successfully!');
      setIsSaving(false);
      setShowSuccessAlert(true);
      setAlertMessage('კოტეჯი წარმატებით შენახულია!');

      // Redirect after showing success message
      setTimeout(() => {
        console.log('🔄 Redirecting to cottages list...');
        navigate('/admin/cottages');
      }, 2000);

    } catch (error) {
      console.error('❌ Error saving cottage:', error);
      console.error('❌ Error details:', error);
      setIsSaving(false);
      setAlertMessage('კოტეჯის შენახვისას მოხდა შეცდომა: ' + (error as Error).message);
      setShowAlert(true);
    }
  }

    proceedWithSubmission();
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
  }) => (
    <div 
      className={`sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-all duration-200 ${
        stickySection === sectionKey ? 'shadow-lg border-blue-200 dark:border-blue-700' : ''
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
          {errors[sectionKey] && (
            <div className="flex items-center text-red-500">
              <AlertCircle className="w-5 h-5 mr-1" />
              <span className="text-sm font-medium">შეცდომა</span>
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
                                errors.name ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600'
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

                        {/* Basic Numbers Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {[
                            { key: 'pricePerNight', label: 'ფასი ღამეში (₾)', icon: DollarSign, placeholder: '150' },
                            { key: 'maxGuests', label: 'მაქს. სტუმრები', icon: Users, placeholder: '4' },
                            { key: 'bedrooms', label: 'საძინებლები', icon: Home, placeholder: '2' },
                            { key: 'bathrooms', label: 'სააბაზანოები', icon: Bath, placeholder: '1' }
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                {field.label} *
                              </label>
                              <div className="relative">
                                <field.icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                  type="number"
                                  name={field.key}
                                  value={formData[field.key as keyof typeof formData] as string}
                                  onChange={handleChange}
                                  min="1"
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

              {/* Pricing Section */}
              <div id="section-pricing">
                <SectionHeader 
                  title="ფასების მართვა" 
                  icon={DollarSign} 
                  sectionKey="pricing" 
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
                      <div className="p-8 space-y-6">

                        {/* Pricing Mode Toggle */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3" />
                              <label className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                                სეზონური ფასების გამოყენება
                              </label>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.hasSeasonalPricing}
                                onChange={(e) => handleSeasonalPricingToggle(e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          <p className="text-blue-700 dark:text-blue-300">
                            სეზონური ფასების გააქტიურებით შეძლებთ განსხვავებული ფასების დაყენებას სხვადასხვა სეზონში.
                          </p>
                        </div>

                        {/* Seasonal Pricing */}
                        <AnimatePresence>
                          {formData.hasSeasonalPricing && (
                            <motion.div
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              className="space-y-6"
                            >
                              <div className="flex items-center justify-between">
                                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                                  სეზონური ფასები
                                </h4>
                                <div className="flex gap-2">
                                  {[
                                    { key: 'winterPrice', label: 'ზამთარი', color: 'blue', emoji: '❄️' },
                                    { key: 'springPrice', label: 'გაზაფხული', color: 'green', emoji: '🌸' },
                                    { key: 'summerPrice', label: 'ზაფხული', color: 'yellow', emoji: '☀️' },
                                    { key: 'autumnPrice', label: 'შემოდგომა', color: 'orange', emoji: '🍂' }
                                  ].map(season => (
                                    formData[season.key as keyof typeof formData] && (
                                      <motion.button
                                        key={season.key}
                                        type="button"
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => copyPriceToAll(formData[season.key as keyof typeof formData] as string)}
                                        className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center bg-${season.color}-100 text-${season.color}-800 hover:bg-${season.color}-200 dark:bg-${season.color}-900/30 dark:text-${season.color}-200 transition-colors shadow-md`}
                                        title={`${season.label}ის ფასი ყველასთვის`}
                                      >
                                        <Copy className="w-3 h-3 mr-1" />
                                        {season.emoji} {season.label}
                                      </motion.button>
                                    )
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[
                                  { key: 'winterPrice', label: 'ზამთრის ფასი', emoji: '❄️', placeholder: '100', color: 'blue' },
                                  { key: 'springPrice', label: 'გაზაფხულის ფასი', emoji: '🌸', placeholder: '120', color: 'green' },
                                  { key: 'summerPrice', label: 'ზაფხულის ფასი', emoji: '☀️', placeholder: '200', color: 'yellow' },
                                  { key: 'autumnPrice', label: 'შემოდგომის ფასი', emoji: '🍂', placeholder: '150', color: 'orange' }
                                ].map((season) => (
                                  <div key={season.key} className={`bg-${season.color}-50 dark:bg-${season.color}-900/20 p-4 rounded-xl border border-${season.color}-200 dark:border-${season.color}-800`}>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                      {season.emoji} {season.label}
                                    </label>
                                    <input
                                      type="number"
                                      name={season.key}
                                      value={formData[season.key as keyof typeof formData] as string}
                                      onChange={handleChange}
                                      min="1"
                                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      placeholder={season.placeholder}
                                    />
                                  </div>
                                ))}
                              </div>

                              {errors.seasonal && (
                                <motion.p
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="text-sm text-red-600 dark:text-red-400 flex items-center bg-red-50 dark:bg-red-900/20 p-3 rounded-xl"
                                >
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  {errors.seasonal}
                                </motion.p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Amenities Section */}
              <div id="section-amenities">
                <SectionHeader 
                  title="დამატებითი პარამეტრები" 
                  icon={Plus} 
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
                                placeholder="მაგ. უფასო WiFi, პარკინგი, საუზმე"
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
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-12 text-center hover:border-blue-500 transition-colors bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
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
                                  <img
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
                      <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  icon={DollarSign} 
                  sectionKey="bank" 
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
                      <div className="p-8">
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl p-8">
                          <h4 className="text-xl font-bold text-green-800 dark:text-green-200 mb-6 flex items-center">
                            💳 ბანკის ანგარიშის ინფორმაცია
                          </h4>

          {/* Simplified Bank Account Selection */}
          {savedBankAccounts.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-green-700 dark:text-green-300 mb-3">
                  ბანკის ანგარიშის არჩევა
                </label>
                <select
                  value={selectedBankAccount}
                  onChange={(e) => handleBankAccountSelect(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-green-200 dark:border-green-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">აირჩიეთ შენახული ანგარიში</option>
                  {savedBankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      🏦 {account.bank} - {account.accountHolderName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">ან</span>
              </div>

              <button
                type="button"
                onClick={() => setShowManualBankEntry(!showManualBankEntry)}
                className="w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                ახალი ანგარიშის დამატება
              </button>
            </div>
          ) : (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center">
                <Info className="w-4 h-4 mr-2" />
                ახალი ბანკის ანგარიშის დამატება
              </p>
            </div>
          )}

          <div className="mt-6">
            <BankAccountField
              value={bankAccountData}
              onChange={setBankAccountData}
              required={true}
            />
          </div>
                        </div>

                        {/* Bank Section Error */}
                        {errors.bank && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800"
                          >
                            <div className="flex items-center text-red-800 dark:text-red-200">
                              <AlertCircle className="w-5 h-5 mr-2" />
                              <span className="font-medium">{errors.bank}</span>
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
      </div>

      {/* Alert Modals */}
      <AnimatePresence>
        {showAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">შეცდომა</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowAlert(false);
                      setAlertMessage('');
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6">{alertMessage}</p>
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowAlert(false);
                      setAlertMessage('');
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    გასაგები
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">წარმატება</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowSuccessAlert(false);
                      setAlertMessage('');
                      navigate('/admin/cottages');
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6">{alertMessage}</p>
                <div className="flex justify-end">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowSuccessAlert(false);
                      setAlertMessage('');
                      navigate('/admin/cottages');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    გასაგები
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Warning Toast */}
        <WarningToast
          isVisible={isWarningToastVisible}
          onClose={() => setIsWarningToastVisible(false)}
          messages={Object.values(errors).filter(Boolean)}
          title="ფორმის შევსება დაუსრულებელია"
          type="warning"
          position="center"
          autoClose={false}
        />
    </div>
  );
};

export default CottageForm;