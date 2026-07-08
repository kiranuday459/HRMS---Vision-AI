/**
 * Form Validation Utilities
 * Comprehensive validation rules for all form fields across the application
 */

// ============================================================================
// NAME FIELD VALIDATION (First Name, Middle Name, Last Name)
// ============================================================================
export const validateName = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "Name is required"
    };
  }

  const trimmedValue = value.trim();

  // Check maximum length (32 characters)
  if (trimmedValue.length > 32) {
    return {
      isValid: false,
      error: "Only alphabets are allowed, max 32 characters."
    };
  }

  // Check if contains only alphabets and spaces
  const nameRegex = /^[a-zA-Z\s]*$/;
  if (!nameRegex.test(trimmedValue)) {
    return {
      isValid: false,
      error: "Only alphabets are allowed, max 32 characters."
    };
  }

  // Check minimum length (at least 1 character after trim)
  if (trimmedValue.length === 0) {
    return {
      isValid: false,
      error: "Name cannot be empty"
    };
  }

  return {
    isValid: true,
    error: null,
    value: trimmedValue
  };
};

// ============================================================================
// MOBILE NUMBER VALIDATION (Exactly 11 digits)
// ============================================================================
export const validateMobileNumber = (value, countryCode = '+91') => {
  if (!value) {
    return {
      isValid: false,
      error: "Mobile number is required"
    };
  }

  // Remove all non-digit characters
  const digitsOnly = value.replace(/\D/g, "");

  // Validate based on country code
  if (countryCode === '+91' || countryCode === '+91 (IN)') {
    // India: 10 digits
    if (digitsOnly.length !== 10) {
      return {
        isValid: false,
        error: "Mobile number must be exactly 10 digits."
      };
    }
  } else if (countryCode === '+81' || countryCode === '+81 (JP)') {
    // Japan: 11 digits (without leading 0)
    if (digitsOnly.length !== 11) {
      return {
        isValid: false,
        error: "Mobile number must be exactly 11 digits."
      };
    }
  } else {
    // Default: 10 digits
    if (digitsOnly.length !== 10) {
      return {
        isValid: false,
        error: "Mobile number must be exactly 10 digits."
      };
    }
  }

  return {
    isValid: true,
    error: null,
    value: digitsOnly
  };
};

// ============================================================================
// AADHAAR NUMBER VALIDATION (Exactly 12 digits)
// ============================================================================
export const validateAadhaar = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "Aadhaar number is required"
    };
  }

  // Remove all non-digit characters
  const digitsOnly = value.replace(/\D/g, "");

  // Check if exactly 12 digits
  if (digitsOnly.length !== 12) {
    return {
      isValid: false,
      error: "Aadhaar number must be exactly 12 digits."
    };
  }

  return {
    isValid: true,
    error: null,
    value: digitsOnly
  };
};

// ============================================================================
// PAN CARD VALIDATION (Exactly 10 characters, format: 5 letters + 4 digits + 1 letter)
// ============================================================================
export const validatePAN = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "PAN number is required"
    };
  }

  const trimmedValue = value.trim().toUpperCase();

  // Check for special characters first
  if (!/^[A-Z0-9]*$/.test(trimmedValue)) {
    return {
      isValid: false,
      error: "PAN number must contain only alphanumeric characters, no special characters."
    };
  }

  // Check length
  if (trimmedValue.length !== 10) {
    return {
      isValid: false,
      error: "PAN number must be exactly 10 characters."
    };
  }

  // Check PAN format: 5 letters + 4 digits + 1 letter
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(trimmedValue)) {
    return {
      isValid: false,
      error: "Invalid PAN format. Format should be: 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)."
    };
  }

  return {
    isValid: true,
    error: null,
    value: trimmedValue
  };
};

// ============================================================================
// ADDRESS FIELD VALIDATION (Max 252 characters)
// ============================================================================
export const validateAddress = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "Address is required"
    };
  }

  const trimmedValue = value.trim();

  // Check maximum length (252 characters)
  if (trimmedValue.length > 252) {
    return {
      isValid: false,
      error: "Address cannot exceed 252 characters."
    };
  }

  // Check minimum length (at least 5 characters)
  if (trimmedValue.length < 5) {
    return {
      isValid: false,
      error: "Address must be at least 5 characters"
    };
  }

  return {
    isValid: true,
    error: null,
    value: trimmedValue,
    charCount: trimmedValue.length,
    maxChars: 252
  };
};

// ============================================================================
// EMAIL VALIDATION
// ============================================================================
export const validateEmail = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "Email is required"
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return {
      isValid: false,
      error: "Please enter a valid email address"
    };
  }

  return {
    isValid: true,
    error: null,
    value: value.trim()
  };
};

// ============================================================================
// FILE UPLOAD VALIDATION
// ============================================================================
export const validateFileUpload = (file) => {
  if (!file) {
    return {
      isValid: false,
      error: "File is required"
    };
  }

  // Maximum file size: 5 MB
  const maxSizeInMB = 5;
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  if (file.size > maxSizeInBytes) {
    return {
      isValid: false,
      error: "File size must not exceed 5MB."
    };
  }

  // Allowed file types
  const allowedExtensions = ['pdf', 'zip', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
  const fileExtension = file.name.split('.').pop().toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return {
      isValid: false,
      error: "Only PDF, ZIP, Word, JPG, and PNG files are accepted."
    };
  }

  // Check MIME type for extra validation
  const allowedMimeTypes = [
    'application/pdf',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ];

  if (!allowedMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: "Only PDF, ZIP, Word, JPG, and PNG files are accepted."
    };
  }

  return {
    isValid: true,
    error: null,
    file: file,
    maxSizeInMB: maxSizeInMB,
    allowedFormats: ['PDF', 'ZIP', 'DOC', 'DOCX', 'JPG', 'PNG']
  };
};

// ============================================================================
// EMERGENCY RELATIONSHIP VALIDATION
// ============================================================================
export const EMERGENCY_RELATIONSHIPS = [
  'Father',
  'Mother',
  'Brother',
  'Sister'
];

export const validateEmergencyRelationship = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "Relationship is required"
    };
  }

  if (!EMERGENCY_RELATIONSHIPS.includes(value)) {
    return {
      isValid: false,
      error: "Please select a valid relationship"
    };
  }

  return {
    isValid: true,
    error: null,
    value: value
  };
};

// ============================================================================
// DATE OF BIRTH VALIDATION
// ============================================================================
export const validateDateOfBirth = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "Date of birth is required"
    };
  }

  const birthDate = new Date(value);
  const today = new Date();

  // Calculate age
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Check if date is in future
  if (birthDate > today) {
    return {
      isValid: false,
      error: "Date of birth cannot be in the future"
    };
  }

  // Check minimum age (18 years)
  if (age < 18) {
    return {
      isValid: false,
      error: "You must be at least 18 years old"
    };
  }

  // Check maximum age (120 years)
  if (age > 120) {
    return {
      isValid: false,
      error: "Please enter a valid date of birth"
    };
  }

  return {
    isValid: true,
    error: null,
    value: value,
    age: age
  };
};

// ============================================================================
// GENERIC REQUIRED FIELD VALIDATION
// ============================================================================
export const validateRequired = (value, fieldName = "This field") => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return {
      isValid: false,
      error: `${fieldName} is required`
    };
  }

  return {
    isValid: true,
    error: null,
    value: value
  };
};

// ============================================================================
// PASSPORT VALIDATION (8-9 alphanumeric characters)
// ============================================================================
export const validatePassport = (value) => {
  if (!value) {
    return {
      isValid: false,
      error: "Passport number is required"
    };
  }

  const trimmedValue = value.trim().toUpperCase();

  // Check for special characters first
  if (!/^[A-Z0-9]*$/.test(trimmedValue)) {
    return {
      isValid: false,
      error: "Passport number must contain only alphanumeric characters, no special characters."
    };
  }

  const passportRegex = /^[A-Z0-9]{8,9}$/;

  if (!passportRegex.test(trimmedValue)) {
    return {
      isValid: false,
      error: "Passport number must be 8-9 alphanumeric characters"
    };
  }

  return {
    isValid: true,
    error: null,
    value: trimmedValue
  };
};

// ============================================================================
// UTILITY: SANITIZE NAME INPUT (Real-time filtering)
// ============================================================================
export const sanitizeName = (value) => {
  return value.replace(/[^a-zA-Z\s]/g, "").slice(0, 32);
};

// ============================================================================
// UTILITY: SANITIZE MOBILE NUMBER (Real-time filtering)
// ============================================================================
export const sanitizeMobileNumber = (value) => {
  return value.replace(/\D/g, "").slice(0, 15);
};

// ============================================================================
// UTILITY: COUNTRY-AWARE MOBILE NUMBER RULES
// India (+91) → 10 digits | Japan (+81) → 11 digits
// ============================================================================
export const getMobileMaxDigits = (countryCode = '+91') => {
  if (countryCode === '+81' || countryCode === '+81 (JP)') return 11;
  return 10; // India and default
};

// Strip every non-digit (blocks letters, spaces, special chars) and cap the
// length to the selected country's digit limit.
export const sanitizeMobileNumberByCountry = (value, countryCode = '+91') => {
  return String(value ?? "").replace(/\D/g, "").slice(0, getMobileMaxDigits(countryCode));
};

// ============================================================================
// UTILITY: SANITIZE NUMERIC FIELDS (Real-time filtering)
// ============================================================================
export const sanitizeNumeric = (value) => {
  return value.replace(/\D/g, "");
};

// ============================================================================
// UTILITY: SANITIZE PAN (Real-time filtering - alphanumeric only, max 10)
// ============================================================================
export const sanitizePAN = (value) => {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
};

// ============================================================================
// UTILITY: SANITIZE PASSPORT (Real-time filtering - alphanumeric only, max 9)
// ============================================================================
export const sanitizePassport = (value) => {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 9).toUpperCase();
};

// ============================================================================
// UTILITY: GET CHARACTER COUNT FOR ADDRESS
// ============================================================================
export const getAddressCharCount = (value) => {
  return {
    current: value.length,
    max: 252,
    display: `${value.length}/252`
  };
};

// ============================================================================
// UTILITY: VALIDATE FORM STATE
// ============================================================================
export const isFormValid = (errors) => {
  return Object.values(errors).every(error => !error);
};
