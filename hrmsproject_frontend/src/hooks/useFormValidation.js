/**
 * Custom Hook: useFormValidation
 * Manages form state and validation across components
 */

import { useState, useCallback } from 'react';

/**
 * Hook for managing form validation state and errors
 * @param {Object} initialValues - Initial form values
 * @param {Object} validationRules - Field-level validation functions
 * @returns {Object} Form state, handlers, and validation methods
 */
export const useFormValidation = (initialValues, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate a single field
   */
  const validateField = useCallback((fieldName, fieldValue) => {
    if (validationRules[fieldName]) {
      const validation = validationRules[fieldName](fieldValue);
      return validation.error || null;
    }
    return null;
  }, [validationRules]);

  /**
   * Handle field change with real-time validation
   */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    // Update value
    setValues(prev => ({
      ...prev,
      [name]: fieldValue
    }));

    // Real-time validation if field has been touched
    if (touched[name]) {
      const error = validateField(name, fieldValue);
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [touched, validateField]);

  /**
   * Handle field blur (mark as touched)
   */
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;

    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    // Validate field
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, [validateField]);

  /**
   * Validate all fields
   */
  const validateForm = useCallback(() => {
    const newErrors = {};

    Object.keys(validationRules).forEach(fieldName => {
      const error = validateField(fieldName, values[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    setErrors(newErrors);
    setTouched(
      Object.keys(validationRules).reduce((acc, field) => ({
        ...acc,
        [field]: true
      }), {})
    );

    return Object.keys(newErrors).length === 0;
  }, [validationRules, validateField, values]);

  /**
   * Check if form is valid
   */
  const isFormValid = useCallback(() => {
    return Object.values(errors).every(error => !error);
  }, [errors]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  /**
   * Set field error manually
   */
  const setFieldError = useCallback((fieldName, error) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error
    }));
  }, []);

  /**
   * Set field value manually
   */
  const setFieldValue = useCallback((fieldName, value) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setIsSubmitting,
    handleChange,
    handleBlur,
    validateForm,
    validateField,
    isFormValid,
    resetForm,
    setFieldError,
    setFieldValue,
    setValues,
    setTouched
  };
};

export default useFormValidation;
