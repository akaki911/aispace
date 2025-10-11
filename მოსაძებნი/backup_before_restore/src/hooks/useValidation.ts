
import { useState } from 'react';
import { globalValidationService, ValidationResult } from '../services/globalValidationService';
import { FieldValidator } from '../utils/validateFields';

export const useValidation = () => {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isWarningToastVisible, setIsWarningToastVisible] = useState(false);

  const showValidationErrors = (errors: string[], useToast = false) => {
    setValidationErrors(errors);
    if (useToast) {
      setIsWarningToastVisible(true);
    } else {
      setIsValidationModalOpen(true);
    }
  };

  const hideValidationErrors = () => {
    setValidationErrors([]);
    setIsValidationModalOpen(false);
    setIsWarningToastVisible(false);
  };

  const showWarningToast = (errors: string[]) => {
    setValidationErrors(errors);
    setIsWarningToastVisible(true);
  };

  const validateAndProceed = <T extends Record<string, any>>(
    formData: T,
    validationType: 'cottage' | 'booking' | 'vehicle' | 'hotel' | 'user',
    onSuccess: () => void
  ): boolean => {
    let result: ValidationResult;

    switch (validationType) {
      case 'cottage':
        result = globalValidationService.validateCottageForm(formData);
        break;
      case 'booking':
        result = globalValidationService.validateBookingForm(formData);
        break;
      case 'vehicle':
        result = globalValidationService.validateVehicleForm(formData);
        break;
      case 'hotel':
        result = globalValidationService.validateHotelForm(formData);
        break;
      case 'user':
        result = globalValidationService.validateUserForm(formData);
        break;
      default:
        result = { isValid: false, errors: [], firstErrorMessage: 'Unknown validation type' };
    }

    if (result.isValid) {
      onSuccess();
      return true;
    } else {
      const errorMessages = result.errors.map(error => error.message);
      showValidationErrors(errorMessages);
      return false;
    }
  };

  // Direct validation methods using new utility
  const validateRequired = (formData: Record<string, any>, requiredFields: string[]): string[] => {
    return FieldValidator.validateRequired(formData, requiredFields);
  };

  const validateCottage = (formData: any) => {
    return FieldValidator.validateCottageForm(formData);
  };

  const validateBooking = (formData: any) => {
    return FieldValidator.validateBookingForm(formData);
  };

  const validateVehicle = (formData: any) => {
    return FieldValidator.validateVehicleForm(formData);
  };

  const validateHotel = (formData: any) => {
    return FieldValidator.validateHotelForm(formData);
  };

  const validateUser = (formData: any) => {
    return FieldValidator.validateUserForm(formData);
  };

  return {
    validationErrors,
    isValidationModalOpen,
    isWarningToastVisible,
    showValidationErrors,
    hideValidationErrors,
    showWarningToast,
    validateAndProceed,
    validateForm: globalValidationService.validateForm.bind(globalValidationService),
    // Direct validation methods
    validateRequired,
    validateCottage,
    validateBooking,
    validateVehicle,
    validateHotel,
    validateUser
  };
};
