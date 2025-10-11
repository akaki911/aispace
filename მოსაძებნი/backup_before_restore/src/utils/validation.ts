// ვალიდაციის ფუნქციები პროვაიდერის რეგისტრაციისთვის

export const validatePhoneNumber = (phone: string): boolean => {
  // ქართული მობილურის ნომერი: 5XX XXX XXX
  const georgianPhoneRegex = /^5\d{8}$/;
  const cleanPhone = phone.replace(/\s/g, '');
  return georgianPhoneRegex.test(cleanPhone);
};

export const validatePersonalId = (personalId: string): boolean => {
  // ქართული პირადი ნომერი: 11 ციფრი
  const personalIdRegex = /^\d{11}$/;
  return personalIdRegex.test(personalId);
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateRequiredField = (value: string): boolean => {
  return value.trim().length > 0;
};

interface ValidationResult {
    isValid: boolean;
    message: string;
}

export const validateName = (name: string): ValidationResult => {
  if (!name || name.trim() === '') {
    return { isValid: false, message: 'ველის შევსება აუცილებელია' };
  }

  if (name.trim().length < 2) {
    return { isValid: false, message: 'მინიმუმ 2 სიმბოლო' };
  }

  if (name.trim().length > 50) {
    return { isValid: false, message: 'მაქსიმუმ 50 სიმბოლო' };
  }

  const trimmedName = name.trim();

  // Check for Georgian characters
  const georgianPattern = /^[ა-ჰ\s]+$/;
  const englishPattern = /^[A-Za-z\s]+$/;
  const mixedPattern = /^[ა-ჰA-Za-z\s]+$/;

  // Check if contains only Georgian
  if (georgianPattern.test(trimmedName)) {
    return { isValid: true, message: '' };
  }

  // Check if contains only English
  if (englishPattern.test(trimmedName)) {
    return { isValid: true, message: '' };
  }

  // Check if mixed but valid characters
  if (mixedPattern.test(trimmedName)) {
    return { isValid: true, message: '' };
  }

  // Contains invalid characters
  const hasGeorgian = /[ა-ჰ]/.test(trimmedName);
  const hasEnglish = /[A-Za-z]/.test(trimmedName);
  const hasNumbers = /[0-9]/.test(trimmedName);
  const hasSpecialChars = /[^ა-ჰA-Za-z\s]/.test(trimmedName);

  if (hasNumbers) {
    return { isValid: false, message: '⚠️ სახელში/გვარში ციფრები არ შეიძლება იყოს' };
  }

  if (hasSpecialChars) {
    return { isValid: false, message: '⚠️ სახელში/გვარში სპეციალური სიმბოლოები არ შეიძლება იყოს' };
  }

  // This should not happen, but just in case
  return { isValid: false, message: '⚠️ გამოიყენეთ მხოლოდ ქართული ან ინგლისური ასოები' };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password || password.trim() === '') {
    return { isValid: false, message: 'პაროლი აუცილებელია' };
  }

  if (password.length < 6) {
    return { isValid: false, message: `⚠️ პაროლი ძალიან მოკლეა! მინიმუმ 6 სიმბოლო საჭიროა (ახლა ${password.length})` };
  }

  if (password.length > 50) {
    return { isValid: false, message: '⚠️ პაროლი ძალიან გრძელია! მაქსიმუმ 50 სიმბოლო' };
  }

  // Check for spaces
  if (password.includes(' ')) {
    return { isValid: false, message: '⚠️ პაროლში გამოტოვებები (სპეისები) დაუშვებელია' };
  }

  // Recommend stronger password
  if (password.length >= 6 && password.length < 8) {
    return { isValid: true, message: '💡 რეკომენდაცია: უკეთესი უსაფრთხოებისთვის გამოიყენეთ 8+ სიმბოლო' };
  }

  return { isValid: true, message: '' };
};

export const validatePhoneWithMessage = (phone: string): ValidationResult => {
  if (!phone || phone.trim() === '') {
    return { isValid: false, message: 'ტელეფონის ნომერი აუცილებელია' };
  }

  // Remove any spaces, dashes, or plus signs
  const cleanPhone = phone.replace(/[\s\-\+]/g, '');

  // Check for English characters
  const hasEnglishChars = /[A-Za-z]/.test(cleanPhone);
  if (hasEnglishChars) {
    return { isValid: false, message: '⚠️ ტელეფონში ინგლისური ასოები დაუშვებელია! გამოიყენეთ მხოლოდ ციფრები' };
  }

  // Check for Georgian characters  
  const hasGeorgianChars = /[ა-ჰ]/.test(cleanPhone);
  if (hasGeorgianChars) {
    return { isValid: false, message: '⚠️ ტელეფონში ქართული ასოები დაუშვებელია! გამოიყენეთ მხოლოდ ციფრები' };
  }

  // Check for special characters (except allowed ones that we already removed)
  const hasSpecialChars = /[^0-9]/.test(cleanPhone);
  if (hasSpecialChars) {
    return { isValid: false, message: '⚠️ ტელეფონში სპეციალური სიმბოლოები დაუშვებელია! გამოიყენეთ მხოლოდ ციფრები' };
  }

  // Check if it contains only digits
  if (!/^\d+$/.test(cleanPhone)) {
    return { isValid: false, message: '⚠️ ტელეფონი უნდა შეიცავდეს მხოლოდ ციფრებს' };
  }

  // Check length
  if (cleanPhone.length < 9) {
    return { isValid: false, message: `⚠️ ტელეფონი ძალიან მოკლეა! უნდა იყოს 9 ციფრი (ახლა ${cleanPhone.length})` };
  }

  if (cleanPhone.length > 9) {
    return { isValid: false, message: `⚠️ ტელეფონი ძალიან გრძელია! უნდა იყოს 9 ციფრი (ახლა ${cleanPhone.length})` };
  }

  // Check if starts with 5
  if (!cleanPhone.startsWith('5')) {
    return { isValid: false, message: '⚠️ ტელეფონი უნდა იწყებოდეს ციფრით 5 (მაგ: 598123456)' };
  }

  return { isValid: true, message: '' };
};

export const validatePersonalIdWithMessage = (personalId: string): ValidationResult => {
  if (!personalId || personalId.trim() === '') {
    return { isValid: false, message: 'პირადი ნომერი აუცილებელია' };
  }

  // Remove any spaces or dashes
  const cleanId = personalId.replace(/[\s\-]/g, '');

  // Check for English characters
  const hasEnglishChars = /[A-Za-z]/.test(cleanId);
  if (hasEnglishChars) {
    return { isValid: false, message: '⚠️ პირად ნომერში ინგლისური ასოები დაუშვებელია! გამოიყენეთ მხოლოდ ციფრები' };
  }

  // Check for Georgian characters
  const hasGeorgianChars = /[ა-ჰ]/.test(cleanId);
  if (hasGeorgianChars) {
    return { isValid: false, message: '⚠️ პირად ნომერში ქართული ასოები დაუშვებელია! გამოიყენეთ მხოლოდ ციფრები' };
  }

  // Check for special characters (except allowed ones that we already removed)
  const hasSpecialChars = /[^0-9]/.test(cleanId);
  if (hasSpecialChars) {
    return { isValid: false, message: '⚠️ პირად ნომერში სპეციალური სიმბოლოები დაუშვებელია! გამოიყენეთ მხოლოდ ციფრები' };
  }

  // Check if it contains only digits
  if (!/^\d+$/.test(cleanId)) {
    return { isValid: false, message: '⚠️ პირადი ნომერი უნდა შეიცავდეს მხოლოდ ციფრებს' };
  }

  // Check length
  if (cleanId.length < 11) {
    return { isValid: false, message: `⚠️ პირადი ნომერი ძალიან მოკლეა! უნდა იყოს 11 ციფრი (ახლა ${cleanId.length})` };
  }

  if (cleanId.length > 11) {
    return { isValid: false, message: `⚠️ პირადი ნომერი ძალიან გრძელია! უნდა იყოს 11 ციფრი (ახლა ${cleanId.length})` };
  }

  return { isValid: true, message: '' };
};

export interface ValidationError {
  field: string;
  message: string;
}

export const validateInput = (formData: {
  email: string;
  name: string;
  surname: string;
  phoneNumber: string;
  personalId: string;
  physicalAddress: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!validateRequiredField(formData.email)) {
    errors.push({ field: 'email', message: 'ელ-ფოსტა სავალდებულოა' });
  } else if (!validateEmail(formData.email)) {
    errors.push({ field: 'email', message: 'ელ-ფოსტის ფორმატი არასწორია. მაგალითი: name@example.com' });
  }

  const nameValidation = validateName(formData.name);
  if (!nameValidation.isValid) {
    errors.push({ field: 'name', message: nameValidation.message });
  }

  const surnameValidation = validateName(formData.surname);
  if (!surnameValidation.isValid) {
    errors.push({ field: 'surname', message: surnameValidation.message });
  }

  const phoneValidation = validatePhoneWithMessage(formData.phoneNumber);
  if (!phoneValidation.isValid) {
    errors.push({ field: 'phoneNumber', message: phoneValidation.message });
  }

  const personalIdValidation = validatePersonalIdWithMessage(formData.personalId);
  if (!personalIdValidation.isValid) {
    errors.push({ field: 'personalId', message: personalIdValidation.message });
  }

  if (!validateRequiredField(formData.physicalAddress)) {
    errors.push({ field: 'physicalAddress', message: 'ფიზიკური მისამართი სავალდებულოა' });
  }

  return errors;
};

export const validateNotes = (notes: string): ValidationResult => {
  if (!notes || notes.trim() === '') {
    return { isValid: true, message: '' }; // Notes are optional
  }

  if (notes.length > 500) {
    return { isValid: false, message: `⚠️ შენიშვნები ძალიან გრძელია! მაქსიმუმ 500 სიმბოლო (ახლა ${notes.length})` };
  }

  // Allow Georgian, English, numbers, punctuation, and common symbols
  const validPattern = /^[ა-ჰA-Za-z0-9\s.,!?;:()\-\n\r"'„"«»]+$/;
  if (!validPattern.test(notes)) {
    return { isValid: false, message: '⚠️ შენიშვნებში გამოიყენეთ მხოლოდ ქართული/ინგლისური ასოები, ციფრები და ძირითადი პუნქტუაცია' };
  }

  return { isValid: true, message: '' };
};

export const validateIBAN = (iban: string): ValidationResult => {
  if (!iban || iban.trim() === '') {
    return { isValid: false, message: 'ბანკის ანგარიშის ნომერი (IBAN) აუცილებელია' };
  }

  // Remove spaces and convert to uppercase
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();

  // Check if contains only valid characters (letters and numbers)
  const validCharsPattern = /^[A-Z0-9]+$/;
  if (!validCharsPattern.test(cleanIban)) {
    return { isValid: false, message: '⚠️ IBAN უნდა შეიცავდეს მხოლოდ ინგლისურ ასოებს და ციფრებს' };
  }

  // Check if it starts with GE (Georgian IBAN)
  if (!cleanIban.startsWith('GE')) {
    return { isValid: false, message: '⚠️ ქართული IBAN უნდა იწყებოდეს "GE"-ით (მაგ: GE29NB0000000101904917)' };
  }

  // Check exact length (22 characters for Georgian IBAN)
  if (cleanIban.length !== 22) {
    return { 
      isValid: false, 
      message: `⚠️ ქართული IBAN უნდა იყოს ზუსტად 22 სიმბოლო (ახლა ${cleanIban.length}). ფორმატი: GE + 2 ციფრი + 18 სიმბოლო` 
    };
  }

  // Check if the first 4 characters are correct format (GE + 2 digits)
  const countryAndCheckDigits = cleanIban.substring(0, 4);
  if (!/^GE\d{2}$/.test(countryAndCheckDigits)) {
    return { isValid: false, message: '⚠️ IBAN ფორმატი არასწორია. უნდა იყოს: GE + 2 ციფრი + 18 სიმბოლო (მაგ: GE29NB0000000101904917)' };
  }

  // Check if the remaining 18 characters are alphanumeric
  const bankAndAccount = cleanIban.substring(4);
  if (bankAndAccount.length !== 18) {
    return { isValid: false, message: '⚠️ IBAN ფორმატი არასწორია. GE-ის შემდეგ უნდა იყოს 18 სიმბოლო' };
  }

  if (!/^[A-Z0-9]{18}$/.test(bankAndAccount)) {
    return { isValid: false, message: '⚠️ IBAN-ის ბანკის და ანგარიშის ნაწილი უნდა შეიცავდეს მხოლოდ ინგლისურ ასოებს და ციფრებს' };
  }

  return { isValid: true, message: '✅ IBAN ფორმატი სწორია' };
};