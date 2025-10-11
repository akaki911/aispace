
interface ValidationRule {
  field: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean;
  displayName?: string;
  errorMessage?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  missingFields: string[];
  invalidFields: string[];
}

/**
 * Global validation utility for consistent form validation
 */
export class FieldValidator {
  /**
   * Simple validation that checks for required fields
   */
  static validateRequired(formData: Record<string, any>, requiredFields: string[]): string[] {
    const missingFields: string[] = [];
    
    requiredFields.forEach(field => {
      const value = formData[field];
      
      if (value === undefined || value === null || 
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0)) {
        missingFields.push(field);
      }
    });
    
    return missingFields;
  }

  /**
   * Advanced validation with custom rules
   */
  static validateWithRules(formData: Record<string, any>, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    const missingFields: string[] = [];
    const invalidFields: string[] = [];

    rules.forEach(rule => {
      const value = formData[rule.field];
      const displayName = rule.displayName || rule.field;

      // Check required fields
      if (rule.required) {
        if (value === undefined || value === null || 
            (typeof value === 'string' && value.trim() === '') ||
            (Array.isArray(value) && value.length === 0)) {
          missingFields.push(rule.field);
          errors.push(rule.errorMessage || `${displayName} აუცილებელია`);
          return;
        }
      }

      // Skip other validations if field is empty and not required
      if (!rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        return;
      }

      // Length validations
      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        invalidFields.push(rule.field);
        errors.push(rule.errorMessage || `${displayName} უნდა იყოს მინიმუმ ${rule.minLength} სიმბოლო`);
      }

      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        invalidFields.push(rule.field);
        errors.push(rule.errorMessage || `${displayName} არ უნდა აღემატებოდეს ${rule.maxLength} სიმბოლოს`);
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        invalidFields.push(rule.field);
        errors.push(rule.errorMessage || `${displayName} არ შეესაბამება სავალდებულო ფორმატს`);
      }

      // Custom validation
      if (rule.customValidator && !rule.customValidator(value)) {
        invalidFields.push(rule.field);
        errors.push(rule.errorMessage || `${displayName} არ არის ვალიდური`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      missingFields,
      invalidFields
    };
  }

  /**
   * Cottage-specific validation
   */
  static validateCottageForm(formData: any): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'name',
        required: true,
        minLength: 3,
        displayName: 'კოტეჯის სახელი',
        errorMessage: 'კოტეჯის სახელი აუცილებელია (მინიმუმ 3 სიმბოლო)'
      },
      {
        field: 'description',
        required: true,
        minLength: 10,
        displayName: 'აღწერა',
        errorMessage: 'აღწერა აუცილებელია (მინიმუმ 10 სიმბოლო)'
      },
      {
        field: 'location',
        required: true,
        displayName: 'მდებარეობა',
        errorMessage: 'მდებარეობა აუცილებელია'
      },
      {
        field: 'maxGuests',
        required: true,
        customValidator: (value) => !isNaN(Number(value)) && Number(value) > 0,
        displayName: 'სტუმრების რაოდენობა',
        errorMessage: 'სტუმრების რაოდენობა აუცილებელია და უნდა იყოს დადებითი რიცხვი'
      },
      {
        field: 'bankInfo.bankName',
        required: true,
        displayName: 'ბანკის სახელი',
        errorMessage: 'ბანკის არჩევა აუცილებელია'
      },
      {
        field: 'bankInfo.bankAccount',
        required: true,
        pattern: /^GE\d{20}$/,
        displayName: 'ბანკის ანგარიში',
        errorMessage: 'ქართული IBAN უნდა იყოს 22 სიმბოლო (GE + 20 ციფრი)'
      },
      {
        field: 'bankInfo.accountHolderName',
        required: true,
        minLength: 2,
        displayName: 'ანგარიშის მფლობელი',
        errorMessage: 'ანგარიშის მფლობელის სახელი აუცილებელია'
      }
    ];

    const result = this.validateWithRules(formData, rules);

    // Additional cottage-specific validations
    const additionalErrors: string[] = [];

    // Check amenities count (minimum 7)
    const amenitiesCount = Object.values(formData.amenities || {}).filter(Boolean).length;
    const featuresCount = (formData.features || []).filter((f: string) => f.trim() !== '').length;
    const totalComfortFeatures = amenitiesCount + featuresCount;
    
    if (totalComfortFeatures < 7) {
      additionalErrors.push(`მინიმუმ 7 კომფორტი/პარამეტრი უნდა იყოს არჩეული (ამჟამად: ${totalComfortFeatures})`);
    }

    // Check images count (minimum 5)
    const totalImages = (formData.uploadedImages || []).length + (formData.images || []).length;
    if (totalImages < 5) {
      additionalErrors.push(`მინიმუმ 5 სურათი უნდა იყოს ატვირთული (ამჟამად: ${totalImages})`);
    }

    // Check pricing
    const hasAnyMonthlyPricing = formData.activeMonths?.some((month: string) => {
      const pricing = formData.monthlyPricing?.[month];
      return pricing && (pricing.min || pricing.max);
    });

    const hasBasePricing = formData.pricePerNight && 
                          !isNaN(Number(formData.pricePerNight)) && 
                          Number(formData.pricePerNight) > 0;

    if (!hasAnyMonthlyPricing && !hasBasePricing) {
      additionalErrors.push('მინიმუმ ერთი თვის ფასი ან ბაზისური ფასი უნდა იყოს მითითებული');
    }

    return {
      isValid: result.isValid && additionalErrors.length === 0,
      errors: [...result.errors, ...additionalErrors],
      missingFields: result.missingFields,
      invalidFields: result.invalidFields
    };
  }

  /**
   * Booking form validation
   */
  static validateBookingForm(formData: any): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'firstName',
        required: true,
        minLength: 2,
        displayName: 'სახელი',
        errorMessage: 'სახელი აუცილებელია (მინიმუმ 2 სიმბოლო)'
      },
      {
        field: 'lastName',
        required: true,
        minLength: 2,
        displayName: 'გვარი',
        errorMessage: 'გვარი აუცილებელია (მინიმუმ 2 სიმბოლო)'
      },
      {
        field: 'personalId',
        required: true,
        pattern: /^\d{11}$/,
        displayName: 'პირადი ნომერი',
        errorMessage: 'პირადი ნომერი უნდა შეიცავდეს ზუსტად 11 ციფრს'
      },
      {
        field: 'phone',
        required: true,
        pattern: /^\d{9}$/,
        displayName: 'ტელეფონის ნომერი',
        errorMessage: 'ტელეფონის ნომერი უნდა შეიცავდეს ზუსტად 9 ციფრს'
      },
      {
        field: 'adults',
        required: true,
        customValidator: (value) => !isNaN(Number(value)) && Number(value) >= 1,
        displayName: 'ზრდასრულების რაოდენობა',
        errorMessage: 'მინიმუმ 1 ზრდასრული აუცილებელია'
      },
      {
        field: 'startDate',
        required: true,
        displayName: 'მოსვლის თარიღი',
        errorMessage: 'მოსვლის თარიღი აუცილებელია'
      },
      {
        field: 'endDate',
        required: true,
        displayName: 'წასვლის თარიღი',
        errorMessage: 'წასვლის თარიღი აუცილებელია'
      }
    ];

    const result = this.validateWithRules(formData, rules);

    // Additional booking validations
    const additionalErrors: string[] = [];

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      if (endDate <= startDate) {
        additionalErrors.push('წასვლის თარიღი უნდა იყოს მოსვლის თარიღის შემდეგ');
      }
    }

    return {
      isValid: result.isValid && additionalErrors.length === 0,
      errors: [...result.errors, ...additionalErrors],
      missingFields: result.missingFields,
      invalidFields: result.invalidFields
    };
  }

  /**
   * Vehicle form validation
   */
  static validateVehicleForm(formData: any): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'make',
        required: true,
        displayName: 'მარკა',
        errorMessage: 'ავტომობილის მარკა აუცილებელია'
      },
      {
        field: 'model',
        required: true,
        displayName: 'მოდელი',
        errorMessage: 'ავტომობილის მოდელი აუცილებელია'
      },
      {
        field: 'year',
        required: true,
        customValidator: (value) => {
          const year = Number(value);
          return !isNaN(year) && year >= 1990 && year <= new Date().getFullYear() + 1;
        },
        displayName: 'წელი',
        errorMessage: 'მანქანის წელი უნდა იყოს 1990-დან დღემდე'
      },
      {
        field: 'pricePerDay',
        required: true,
        customValidator: (value) => !isNaN(Number(value)) && Number(value) > 0,
        displayName: 'ღირებულება დღეში',
        errorMessage: 'ღირებულება დღეში აუცილებელია და უნდა იყოს დადებითი რიცხვი'
      }
    ];

    return this.validateWithRules(formData, rules);
  }

  /**
   * Hotel form validation
   */
  static validateHotelForm(formData: any): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'name',
        required: true,
        minLength: 3,
        displayName: 'სასტუმროს სახელი',
        errorMessage: 'სასტუმროს სახელი აუცილებელია (მინიმუმ 3 სიმბოლო)'
      },
      {
        field: 'location',
        required: true,
        displayName: 'მდებარეობა',
        errorMessage: 'მდებარეობა აუცილებელია'
      },
      {
        field: 'description',
        required: true,
        minLength: 10,
        displayName: 'აღწერა',
        errorMessage: 'აღწერა აუცილებელია (მინიმუმ 10 სიმბოლო)'
      },
      {
        field: 'pricePerNight',
        required: true,
        customValidator: (value) => !isNaN(Number(value)) && Number(value) > 0,
        displayName: 'ღირებულება ღამეში',
        errorMessage: 'ღირებულება ღამეში აუცილებელია და უნდა იყოს დადებითი რიცხვი'
      }
    ];

    return this.validateWithRules(formData, rules);
  }

  /**
   * User profile validation
   */
  static validateUserForm(formData: any): ValidationResult {
    const rules: ValidationRule[] = [
      {
        field: 'firstName',
        required: true,
        minLength: 2,
        displayName: 'სახელი',
        errorMessage: 'სახელი აუცილებელია (მინიმუმ 2 სიმბოლო)'
      },
      {
        field: 'lastName',
        required: true,
        minLength: 2,
        displayName: 'გვარი',
        errorMessage: 'გვარი აუცილებელია (მინიმუმ 2 სიმბოლო)'
      },
      {
        field: 'email',
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        displayName: 'ელ-ფოსტა',
        errorMessage: 'ვალიდური ელ-ფოსტის მისამართი აუცილებელია'
      }
    ];

    return this.validateWithRules(formData, rules);
  }
}

/**
 * Simple validation function for backward compatibility
 */
export const validateFields = (formData: Record<string, any>, requiredFields: string[]): string[] => {
  return FieldValidator.validateRequired(formData, requiredFields);
};

export default FieldValidator;
