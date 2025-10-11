import { validateInput } from '../utils/validation';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  firstErrorMessage?: string;
}

class GlobalValidationService {
  validateForm(data: any, validationType: string): ValidationResult {
    // Implementation for form validation
    const errors: ValidationError[] = [];
    
    if (!data) {
      errors.push({ field: 'general', message: 'No data provided' });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      firstErrorMessage: errors.length > 0 ? errors[0].message : undefined
    };
  }

  validateCottageForm(data: any): ValidationResult {
    return this.validateForm(data, 'cottage');
  }

  validateBookingForm(data: any): ValidationResult {
    return this.validateForm(data, 'booking');
  }

  validateVehicleForm(data: any): ValidationResult {
    return this.validateForm(data, 'vehicle');
  }

  validateHotelForm(data: any): ValidationResult {
    return this.validateForm(data, 'hotel');
  }

  validateUserForm(data: any): ValidationResult {
    return this.validateForm(data, 'user');
  }
}

export const globalValidationService = new GlobalValidationService();