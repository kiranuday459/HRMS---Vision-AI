import React, { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import {
    validateName,
    validateEmail,
    validateMobileNumber,
    validateDateOfBirth,
    validateRequired,
    sanitizeName,
    sanitizeMobileNumberByCountry,
    getMobileMaxDigits
} from "../utils/formValidation";
import { FormFieldError } from "./FormValidation";

// Allowed roles — Admin and Reporting Manager are excluded
const ALLOWED_ROLES = [
    { value: "Employee", label: "Employee" },
    { value: "HR",       label: "HR" },
];

function sanitize(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function calculateAge(dob) {
    if (!dob) return 0;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

export default function AddEmployeeModal({ open, onClose, onEmployeeCreated }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
    const [phoneError, setPhoneError] = useState("");

    // Field validation errors
    const [fieldErrors, setFieldErrors] = useState({
        firstName: null,
        middleName: null,
        lastName: null,
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
        oryfolksId: null,
        designation: null,
        corporateEmail: null,
        joiningDate: null,
        role: null
    });

    // User creation popup state
    const [showUserPopup, setShowUserPopup] = useState(false);
    const [userCreateLoading, setUserCreateLoading] = useState(false);
    const [userCreateError, setUserCreateError] = useState("");
    const [userCreated, setUserCreated] = useState(false);

    const [userForm, setUserForm] = useState({
        username: "",
        name: "",
        email: "",
    });

    const [formData, setFormData] = useState({
        // Part 1: Personal
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        dateOfBirth: "",
        gender: "",
        // Part 2: Company
        oryfolksId: "",
        designation: "",
        corporateEmail: "",
        joiningDate: "",
        role: ""
    });

    // Remove auto-generation — User must manually enter Company ID and Corporate Email

    // Reset form when modal opens/closes
    useEffect(() => {
        if (open) {
            setStep(1);
            setError("");
            setFieldErrors({
                firstName: null,
                middleName: null,
                lastName: null,
                email: null,
                phoneNumber: null,
                dateOfBirth: null,
                gender: null,
                oryfolksId: null,
                designation: null,
                corporateEmail: null,
                joiningDate: null,
                role: null
            });
            setFormData({
                firstName: "",
                middleName: "",
                lastName: "",
                email: "",
                phoneNumber: "",
                dateOfBirth: "",
                gender: "",
                oryfolksId: "",
                designation: "",
                corporateEmail: "",
                joiningDate: "",
                role: ""
            });
            setShowUserPopup(false);
            setUserCreated(false);
            setPhoneCountryCode("+91");
            setPhoneError("");
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => { document.body.style.overflow = "unset"; };
    }, [open]);

    const handleNext = () => {
        if (step === 1) {
            // Validate all required fields
            const newErrors = {};

            // Validate First Name
            const firstNameValidation = validateName(formData.firstName);
            if (!firstNameValidation.isValid) {
                newErrors.firstName = firstNameValidation.error;
            }

            // Validate Middle Name (optional)
            if (formData.middleName && formData.middleName.trim()) {
                const middleNameValidation = validateName(formData.middleName);
                if (!middleNameValidation.isValid) {
                    newErrors.middleName = middleNameValidation.error;
                }
            }

            // Validate Last Name
            const lastNameValidation = validateName(formData.lastName);
            if (!lastNameValidation.isValid) {
                newErrors.lastName = lastNameValidation.error;
            }

            // Validate Email
            const emailValidation = validateEmail(formData.email);
            if (!emailValidation.isValid) {
                newErrors.email = emailValidation.error;
            }

            // Validate Phone Number (11 digits for Japan, 10 for India)
            const phoneValidation = validateMobileNumber(formData.phoneNumber, phoneCountryCode);
            if (!phoneValidation.isValid) {
                newErrors.phoneNumber = phoneValidation.error;
            }

            // Validate Date of Birth
            const dobValidation = validateDateOfBirth(formData.dateOfBirth);
            if (!dobValidation.isValid) {
                newErrors.dateOfBirth = dobValidation.error;
            }

            // Validate Gender
            if (!formData.gender) {
                newErrors.gender = "Please select a gender";
            }

            setFieldErrors(prev => ({ ...prev, ...newErrors }));

            // If there are errors, don't proceed
            if (Object.keys(newErrors).length > 0) {
                setError("Please fix the validation errors above");
                return;
            }

            setError("");
            setPhoneError("");
            setStep(2);
        }
    };

    const handlePrev = () => setStep(1);

    const handleRoleChange = (role) => {
        setFormData(prev => ({ ...prev, role }));
    };

    const handleSubmit = async () => {
        // Validate company details
        const newErrors = {};

        if (!formData.role) {
            newErrors.role = "Please select a role";
        }

        if (!formData.oryfolksId || !formData.oryfolksId.trim()) {
            newErrors.oryfolksId = "Company ID is required";
        }

        const designationValidation = validateRequired(formData.designation, "Designation");
        if (!designationValidation.isValid) {
            newErrors.designation = designationValidation.error;
        }

        // Validate Corporate Email (required, valid email format)
        const corporateEmailValidation = validateEmail(formData.corporateEmail);
        if (!corporateEmailValidation.isValid) {
            newErrors.corporateEmail = corporateEmailValidation.error;
        }

        if (!formData.joiningDate) {
            newErrors.joiningDate = "Joining Date is required";
        }

        setFieldErrors(prev => ({ ...prev, ...newErrors }));

        if (Object.keys(newErrors).length > 0) {
            setError("Please fix the validation errors above");
            return;
        }

        const { firstName, middleName, lastName } = formData;
        const fullName = middleName
            ? `${firstName} ${middleName} ${lastName}`
            : `${firstName} ${lastName}`;
        const companyId    = formData.oryfolksId;
        const companyEmail = formData.corporateEmail;

        setUserForm({ username: companyId, name: fullName, email: companyEmail });
        setShowUserPopup(true);
        setError("");
    };

    const handleCreateUser = async () => {
        setUserCreateLoading(true);
        setUserCreateError("");

        try {
            const employeeData = {
                ...formData,
                phoneNumber: phoneCountryCode + formData.phoneNumber,
                corporateEmail: formData.corporateEmail,
                createAccount: true,
                active: true,
                bloodGroup: "Unknown",
                maritalStatus: "Single",
                presentAddress: "To be updated",
                permanentAddress: "To be updated",
                emergencyContactName: "To be updated",
                emergencyRelationship: "To be updated",
                emergencyPhone: "0000000000"
            };

            const response = await api("/api/employees", {
                method: "POST",
                body: JSON.stringify(employeeData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to create employee and account");
            }

            setUserCreated(true);
            setTimeout(() => {
                onClose();
                if (onEmployeeCreated) onEmployeeCreated();
            }, 2000);

        } catch (err) {
            setUserCreateError(err.message || "Failed to complete setup");
        } finally {
            setUserCreateLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in scale-in duration-200">
            <div className="absolute inset-0 bg-brand-blue/60 backdrop-blur-sm transition-opacity" onClick={showUserPopup ? null : onClose} />

            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl relative z-10 overflow-y-auto flex flex-col max-h-[90vh] md:max-h-[85vh] transition-all duration-200 modal-scale">

                {/* ── Header ── */}
                <div className="px-8 py-6 bg-gradient-to-r from-brand-blue to-brand-blue/90 border-b border-brand-blue/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="8.5" cy="7" r="4"></circle>
                                    <line x1="20" y1="8" x2="20" y2="14"></line>
                                    <line x1="23" y1="11" x2="17" y2="11"></line>
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Add New Employee</h2>
                                <p className="text-white/60 text-xs font-medium mt-0.5">
                                    Step {step} of 2 • {step === 1 ? "Personal Information" : "Company Details"}
                                </p>
                            </div>
                        </div>
                        {!showUserPopup && (
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/80 hover:text-white">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        )}
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-6 flex gap-2">
                        <div className={`h-1 flex-1 rounded-full transition-all ${step >= 1 ? "bg-brand-yellow" : "bg-white/20"}`}></div>
                        <div className={`h-1 flex-1 rounded-full transition-all ${step >= 2 ? "bg-brand-yellow" : "bg-white/20"}`}></div>
                    </div>
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg flex items-center gap-3">
                            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    {/* ── STEP 1: Personal Info ── */}
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-brand-text mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-brand-blue/10 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-brand-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    </div>
                                    Personal Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">First Name *</label>
                                        <input
                                            type="text"
                                            value={formData.firstName}
                                            onChange={(e) => {
                                                const sanitized = sanitizeName(e.target.value);
                                                setFormData({ ...formData, firstName: sanitized });
                                                const validation = validateName(sanitized);
                                                setFieldErrors({ ...fieldErrors, firstName: validation.error });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.firstName ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            placeholder="Enter first name"
                                            maxLength={32}
                                        />
                                        <FormFieldError error={fieldErrors.firstName} show={!!fieldErrors.firstName} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Middle Name</label>
                                        <input
                                            type="text"
                                            value={formData.middleName}
                                            onChange={(e) => {
                                                const sanitized = sanitizeName(e.target.value);
                                                setFormData({ ...formData, middleName: sanitized });
                                                if (sanitized && sanitized.trim()) {
                                                    const validation = validateName(sanitized);
                                                    setFieldErrors({ ...fieldErrors, middleName: validation.error });
                                                } else {
                                                    setFieldErrors({ ...fieldErrors, middleName: null });
                                                }
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.middleName ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            placeholder="Enter middle name (optional)"
                                            maxLength={32}
                                        />
                                        <FormFieldError error={fieldErrors.middleName} show={!!fieldErrors.middleName} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Last Name *</label>
                                        <input
                                            type="text"
                                            value={formData.lastName}
                                            onChange={(e) => {
                                                const sanitized = sanitizeName(e.target.value);
                                                setFormData({ ...formData, lastName: sanitized });
                                                const validation = validateName(sanitized);
                                                setFieldErrors({ ...fieldErrors, lastName: validation.error });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.lastName ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            placeholder="Enter last name"
                                            maxLength={32}
                                        />
                                        <FormFieldError error={fieldErrors.lastName} show={!!fieldErrors.lastName} />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Personal Email *</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => {
                                                setFormData({ ...formData, email: e.target.value });
                                                const validation = validateEmail(e.target.value);
                                                setFieldErrors({ ...fieldErrors, email: validation.error });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.email ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            placeholder="Enter personal email address"
                                        />
                                        <FormFieldError error={fieldErrors.email} show={!!fieldErrors.email} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Phone Number *</label>
                                        <div className="flex">
                                            <select
                                                value={phoneCountryCode}
                                                onChange={(e) => {
                                                    // Switching country clears the mobile number field.
                                                    setPhoneCountryCode(e.target.value);
                                                    setFormData((prev) => ({ ...prev, phoneNumber: "" }));
                                                    setFieldErrors((prev) => ({ ...prev, phoneNumber: null }));
                                                    setPhoneError("");
                                                }}
                                                className="bg-gray-50 border border-gray-200 rounded-l-lg px-2 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none border-r-0"
                                            >
                                                <option value="+91">🇮🇳 India (+91)</option>
                                                <option value="+81">🇯🇵 Japan (+81)</option>
                                            </select>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={formData.phoneNumber}
                                                onChange={(e) => {
                                                    // Digits only, capped to the country limit (10 IN / 11 JP).
                                                    const sanitized = sanitizeMobileNumberByCountry(e.target.value, phoneCountryCode);
                                                    setFormData({ ...formData, phoneNumber: sanitized });
                                                    const validation = validateMobileNumber(sanitized, phoneCountryCode);
                                                    setFieldErrors({ ...fieldErrors, phoneNumber: validation.error });
                                                    setPhoneError("");
                                                }}
                                                className={`flex-1 w-full bg-gray-50 border border-gray-200 rounded-r-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.phoneNumber ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                                placeholder={phoneCountryCode === "+91" ? "10-digit number" : "11-digit number"}
                                                maxLength={getMobileMaxDigits(phoneCountryCode)}
                                            />
                                        </div>
                                        <FormFieldError error={fieldErrors.phoneNumber} show={!!fieldErrors.phoneNumber} />
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {phoneCountryCode === "+91" ? "India: Enter exactly 10 digits" : "Japan: Enter exactly 11 digits"}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Date of Birth *</label>
                                        <input
                                            type="date"
                                            value={formData.dateOfBirth}
                                            onChange={(e) => {
                                                setFormData({ ...formData, dateOfBirth: e.target.value });
                                                const validation = validateDateOfBirth(e.target.value);
                                                setFieldErrors({ ...fieldErrors, dateOfBirth: validation.error });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.dateOfBirth ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                        />
                                        <FormFieldError error={fieldErrors.dateOfBirth} show={!!fieldErrors.dateOfBirth} />
                                        {formData.dateOfBirth && calculateAge(formData.dateOfBirth) < 18 && (
                                            <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1 animate-pulse">
                                                <span>👉</span>
                                                Employee must be above 18 years and not less than 18 years.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Gender *</label>
                                        <select
                                            value={formData.gender}
                                            onChange={(e) => {
                                                setFormData({ ...formData, gender: e.target.value });
                                                setFieldErrors({ ...fieldErrors, gender: e.target.value ? null : "Please select a gender" });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.gender ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        <FormFieldError error={fieldErrors.gender} show={!!fieldErrors.gender} />
                                    </div>
                                </div>
                            </div>
                        </div>

                    ) : (
                    /* ── STEP 2: Company Details ── */
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold text-brand-text mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-brand-blue/10 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-brand-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                    </div>
                                    Company Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                                    {/* Role — Admin & Reporting Manager excluded */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Role *</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => {
                                                handleRoleChange(e.target.value);
                                                setFieldErrors({ ...fieldErrors, role: e.target.value ? null : "Please select a role" });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.role ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                        >
                                            <option value="">Select Role</option>
                                            {ALLOWED_ROLES.map(r => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                        <FormFieldError error={fieldErrors.role} show={!!fieldErrors.role} />
                                    </div>

                                    {/* Company ID — manually entered, fully editable */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Company ID *</label>
                                        <input
                                            type="text"
                                            value={formData.oryfolksId}
                                            onChange={(e) => {
                                                setFormData({ ...formData, oryfolksId: e.target.value });
                                                setFieldErrors({ ...fieldErrors, oryfolksId: e.target.value.trim() ? null : "Company ID is required" });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.oryfolksId ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            placeholder="Enter company ID"
                                        />
                                        <FormFieldError error={fieldErrors.oryfolksId} show={!!fieldErrors.oryfolksId} />
                                        <p className="text-[10px] text-gray-400 mt-1">Enter a unique company ID (letters, numbers, or mix)</p>
                                    </div>

                                    {/* Designation */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Designation *</label>
                                        <input
                                            type="text"
                                            value={formData.designation}
                                            onChange={(e) => {
                                                setFormData({ ...formData, designation: e.target.value });
                                                setFieldErrors({ ...fieldErrors, designation: e.target.value.trim() ? null : "Designation is required" });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.designation ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            placeholder="Enter designation (e.g. ASE, SSE)"
                                        />
                                        <FormFieldError error={fieldErrors.designation} show={!!fieldErrors.designation} />
                                    </div>

                                    {/* Corporate Email — manually entered, fully editable */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Corporate Email *</label>
                                        <input
                                            type="email"
                                            value={formData.corporateEmail}
                                            onChange={(e) => {
                                                setFormData({ ...formData, corporateEmail: e.target.value });
                                                const validation = validateEmail(e.target.value);
                                                setFieldErrors({ ...fieldErrors, corporateEmail: validation.error });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.corporateEmail ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            placeholder="Enter corporate email address"
                                        />
                                        <FormFieldError error={fieldErrors.corporateEmail} show={!!fieldErrors.corporateEmail} />
                                        <p className="text-[10px] text-gray-400 mt-1">Enter a valid corporate email address (must be properly formatted)</p>
                                    </div>

                                    {/* Joining Date */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-2">Joining Date *</label>
                                        <input
                                            type="date"
                                            value={formData.joiningDate}
                                            onChange={(e) => {
                                                setFormData({ ...formData, joiningDate: e.target.value });
                                                setFieldErrors({ ...fieldErrors, joiningDate: e.target.value ? null : "Joining Date is required" });
                                            }}
                                            className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-brand-text focus:ring-2 focus:ring-brand-blue-dark/10 focus:border-brand-blue-dark transition-all outline-none ${fieldErrors.joiningDate ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                        />
                                        <FormFieldError error={fieldErrors.joiningDate} show={!!fieldErrors.joiningDate} />
                                    </div>

                                </div>

                                {/* Info banner */}
                                {formData.role && (
                                    <div className="mt-4 p-3 bg-brand-blue/5 border border-brand-blue/20 rounded-lg flex items-start gap-2">
                                        <svg className="w-4 h-4 text-brand-text mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                        <p className="text-xs text-brand-text/80 font-medium">
                                            Please manually enter the <strong>Company ID</strong> and <strong>Corporate Email</strong> for this employee. These fields are fully editable and not auto-generated.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-8 py-5 bg-white border-t border-gray-200 flex justify-between items-center">
                    {step === 2 ? (
                        <button
                            onClick={handlePrev}
                            className="w-full sm:w-auto h-11 px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-brand-text hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                            Back
                        </button>
                    ) : (
                        <button
                            onClick={onClose}
                            className="w-full sm:w-auto h-11 px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                    )}

                    {step === 1 ? (
                        <button
                            onClick={handleNext}
                            className="w-full sm:w-auto h-11 px-8 py-2.5 bg-brand-blue-dark text-white rounded-lg font-bold text-sm hover:bg-brand-blue-dark/90 transition-all flex items-center gap-2 shadow-lg shadow-brand-blue/20"
                        >
                            Continue
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full sm:w-auto h-11 px-8 py-2.5 bg-brand-yellow text-brand-text rounded-lg font-bold text-sm hover:bg-brand-yellow/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-yellow/20"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" opacity="0.25"></circle><path d="M4 12a8 8 0 018-8" opacity="0.75"></path></svg>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    Create Employee
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* ── USER CREATION POPUP ── */}
                {showUserPopup && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-brand-blue-dark/90 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                            <div className="px-6 py-5 bg-gradient-to-r from-brand-blue to-brand-blue/90">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Setup Access</h3>
                                        <p className="text-white/60 text-xs font-medium">Create login credentials for {userForm.name}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-5">
                                {userCreateError && (
                                    <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
                                        <p className="text-sm font-medium">{userCreateError}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2">Username (Company ID)</label>
                                    <input
                                        type="text"
                                        value={userForm.username}
                                        readOnly
                                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold text-gray-600 cursor-not-allowed outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-2">Corporate Email</label>
                                    <input
                                        type="email"
                                        value={userForm.email || ""}
                                        readOnly
                                        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed outline-none"
                                    />
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        <span className="text-xs font-bold text-amber-900">Default Password</span>
                                    </div>
                                    <code className="px-2.5 py-1 bg-white border border-amber-300 rounded text-xs font-bold text-amber-900 font-mono">emp123</code>
                                </div>

                                {userCreated ? (
                                    <div className="bg-emerald-500 text-white rounded-lg p-4 flex items-center gap-3">
                                        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"></path></svg>
                                        <span className="text-sm font-bold">Account Created Successfully!</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3 pt-2">
                                        <button
                                            onClick={handleCreateUser}
                                            disabled={userCreateLoading}
                                            className="w-full py-3 bg-brand-blue-dark text-white rounded-lg font-bold text-sm hover:bg-brand-blue-dark/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-blue/20"
                                        >
                                            {userCreateLoading ? "Creating Account..." : "Confirm & Create Account"}
                                        </button>
                                        <button
                                            onClick={() => { setShowUserPopup(false); setUserCreateError(""); }}
                                            className="w-full py-2 text-xs font-bold text-gray-500 hover:text-brand-text transition-all flex items-center justify-center gap-1"
                                        >
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                                            Back to Company Details
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}




