import { useState, useCallback, useRef, useEffect } from 'react';

interface PersonalInfo {
  name: string;
  age: string;
  interests: string;
  notes: string;
  preferredLanguage: "ka" | "en";
  role: "developer" | "designer" | "manager";
  programmingLanguages: string[];
  codeStyle: string;
  currentProject: string;
  openFiles: string[];
}

interface PersonalInfoHook {
  personalInfo: PersonalInfo;
  editData: PersonalInfo;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  setEditData: React.Dispatch<React.SetStateAction<PersonalInfo>>;
  savePersonalInfo: () => void;
}

const defaultPersonalInfo: PersonalInfo = {
  name: "",
  age: "",
  interests: "",
  notes: "",
  preferredLanguage: "ka",
  role: "developer",
  programmingLanguages: [],
  codeStyle: "",
  currentProject: "",
  openFiles: []
};

export const usePersonalInfo = (
  initialData: PersonalInfo = defaultPersonalInfo,
  onSave?: (data: PersonalInfo) => void
): PersonalInfoHook => {
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(initialData);
  const [editData, setEditData] = useState<PersonalInfo>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save function
  const savePersonalInfo = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      setPersonalInfo(editData);
      if (onSave) {
        onSave(editData);
      }
      setIsEditing(false);
    }, 500);
  }, [editData, onSave]);

  // Update editData when personalInfo changes externally - using ref to avoid infinite loop
  const prevInitialDataRef = useRef<PersonalInfo>(initialData);
  
  useEffect(() => {
    const hasChanged = JSON.stringify(prevInitialDataRef.current) !== JSON.stringify(initialData);
    
    if (!isEditing && hasChanged) {
      setEditData(initialData);
      setPersonalInfo(initialData);
      prevInitialDataRef.current = initialData;
    }
  }, [initialData, isEditing]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    personalInfo,
    editData,
    isEditing,
    setIsEditing,
    setEditData,
    savePersonalInfo
  };
};