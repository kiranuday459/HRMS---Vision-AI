/**
 * FormFieldError Component
 * Displays validation error messages below form fields
 */

import React from 'react';

export const FormFieldError = ({ error, show = true }) => {
  if (!show || !error) return null;

  return (
    <span className="field-error" role="alert">
      {error}
    </span>
  );
};

/**
 * FormFieldWrapper Component
 * Wrapper for form fields with consistent styling and error handling
 */
export const FormFieldWrapper = ({
  label,
  error,
  touched,
  children,
  required = false,
  helpText = null,
  maxLength = null,
  currentLength = null
}) => {
  const showError = touched && error;

  return (
    <div className={`form-field-wrapper ${showError ? 'has-error' : ''}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {showError && <FormFieldError error={error} show={true} />}
      {helpText && !showError && (
        <span className="field-help-text">{helpText}</span>
      )}
      {maxLength && currentLength !== null && (
        <div className={`character-counter ${currentLength > maxLength * 0.9 ? 'warning' : ''} ${currentLength > maxLength ? 'error' : ''}`}>
          <span>{currentLength}/{maxLength} characters</span>
        </div>
      )}
    </div>
  );
};

/**
 * FileUploadValidationInfo Component
 * Shows file upload requirements and constraints
 */
export const FileUploadValidationInfo = ({
  allowedFormats = ['PDF', 'ZIP', 'DOC', 'DOCX', 'JPG', 'PNG'],
  maxSizeInMB = 5
}) => {
  return (
    <div className="file-validation-info">
      <strong>Upload Requirements:</strong>
      <ul>
        <li>Accepted formats: {allowedFormats.join(', ')}</li>
        <li>Max size: {maxSizeInMB}MB</li>
      </ul>
    </div>
  );
};

/**
 * CharacterCounter Component
 * Displays character count for text fields
 */
export const CharacterCounter = ({ current = 0, max = 252 }) => {
  const percentage = (current / max) * 100;
  const isWarning = percentage > 80;
  const isError = percentage > 100;

  return (
    <div className={`character-counter ${isWarning ? 'warning' : ''} ${isError ? 'error' : ''}`}>
      <span>
        {current}/{max} characters
      </span>
      {isWarning && !isError && <span className="text-amber-500 text-xs">⚠️ Approaching limit</span>}
      {isError && <span className="text-red-500 text-xs">❌ Limit exceeded</span>}
    </div>
  );
};

/**
 * ValidationSummary Component
 * Displays a summary of all validation errors
 */
export const ValidationSummary = ({ errors = {} }) => {
  const errorList = Object.entries(errors)
    .filter(([_, error]) => error)
    .map(([field, error]) => error);

  if (errorList.length === 0) return null;

  return (
    <div className="validation-summary" role="alert">
      <h3>Please fix the following errors:</h3>
      <ul>
        {errorList.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  );
};

export default FormFieldError;
