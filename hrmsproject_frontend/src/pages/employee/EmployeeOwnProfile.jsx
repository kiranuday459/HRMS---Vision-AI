import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../utils/api";
import {
  validateName,
  validateEmail,
  validateMobileNumber,
  validateAadhaar,
  validatePAN,
  validatePassport,
  validateAddress,
  validateDateOfBirth,
  sanitizeName,
  sanitizeMobileNumberByCountry,
  getMobileMaxDigits,
  sanitizePAN,
  sanitizePassport,
  EMERGENCY_RELATIONSHIPS,
  validateEmergencyRelationship
} from "../../utils/formValidation";
import { FormFieldError, CharacterCounter } from "../../components/FormValidation";
import "../../styles/formValidation.css";

import Logo from '../../assets/visionai-logo.png';
import Sidebar from "../../components/Sidebar";

const splitPhone = (phone) => {
  if (!phone) return { countryCode: "+91", number: "" };
  const str = String(phone);
  // Match against known country codes first. A greedy /\+\d{1,4}/ would eat the first
  // few digits of the actual number (e.g. "+919876543210" → code "+9198"), which
  // truncated the displayed/re-saved mobile number — the root cause of the bug.
  const KNOWN_CODES = ["+91", "+81"];
  for (const cc of KNOWN_CODES) {
    if (str.startsWith(cc)) {
      return { countryCode: cc, number: str.slice(cc.length).replace(/\D/g, "") };
    }
  }
  const match = str.match(/^(\+\d{1,4})(\d+)$/);
  if (match) {
    return { countryCode: match[1], number: match[2] };
  }
  return { countryCode: "+91", number: str.replace(/\D/g, "") };
};

export default function EmployeeOwnProfile({ hideSidebar = false }) {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("personal");
  const [user, setUser] = useState({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoDeleted, setPhotoDeleted] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [originalForm, setOriginalForm] = useState(null);
  const fileInputRef = useRef(null);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setUser(userData);
    fetchEmpData();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  useEffect(() => {
    const fetchLeaveBalance = async () => {
      if (activeSection === 'leave_balance' && employee?.id && !leaveBalance) {
        setFetchingBalance(true);
        try {
          const res = await api(`/api/leaves/balance/${employee.id}`);
          if (res.ok) {
            const json = await res.json();
            setLeaveBalance(json.data);
          }
        } catch (err) {
          console.error("Failed to fetch leave balance:", err);
        } finally {
          setFetchingBalance(false);
        }
      }
    };
    fetchLeaveBalance();
  }, [activeSection, employee?.id, leaveBalance]);

  const fetchEmpData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/api/me/employee");

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load your profile");
      }

      const json = await res.json();
      const data = json.data || json || {};
      setEmployee(data);

      // Populate form
      setForm({
        role: data.designation || "",
        companyId: data.oryfolksId || "",
        companyMail: data.corporateEmail || "",
        joiningDate: data.joiningDate || "",
        personalEmail: data.email || "",
        mobileCountryCode: splitPhone(data.phoneNumber).countryCode,
        mobile: splitPhone(data.phoneNumber).number,
        alternateMobileCountryCode: splitPhone(data.alternatePhone).countryCode,
        alternateMobile: splitPhone(data.alternatePhone).number,
        dob: data.dateOfBirth || "",
        gender: data.gender || "",
        maritalStatus: data.maritalStatus || "",
        bloodGroup: data.bloodGroup || "",
        currentAddress: data.presentAddress || "",
        permanentAddress: data.permanentAddress || "",
        aadhar: data.aadhaarNo || '',
        pan: data.panNo || '',
        passport: data.passportNo || "",
        emergencyContactName: data.emergencyContactName || "",
        emergencyRelationship: data.emergencyRelationship || "",
        emergencyPhoneCountryCode: splitPhone(data.emergencyPhone).countryCode,
        emergencyPhone: splitPhone(data.emergencyPhone).number,
        emergencyAddress: data.emergencyAddress || "",
        education: data.educationList || [],
        employmentHistory: (data.experienceList || []).map(exp => ({
          ...exp,
          startDate: exp.startDate ? convertDateToMonth(exp.startDate) : '',
          endDate: exp.endDate ? convertDateToMonth(exp.endDate) : ''
        })),
        firstName: data.firstName || "",
        middleName: data.middleName || "",
        lastName: data.lastName || "",
        photoUrl: data.photoPath || "",
      });
      setSelectedPhotoFile(null);
      setPhotoPreview(data.photoPath || "");
      setPhotoDeleted(false);
      setPhotoError("");

      if (data.documentList) {
        const files = {
          edu_10th: null,
          edu_12th: null,
          edu_grad: null,
          educational: [],
          course: [],
          technical: [],
          employment: []
        };

        data.documentList.forEach(doc => {
          const fileData = {
            id: doc.id,
            name: doc.fileName,
            preview: doc.fileUrl,
            type: doc.contentType,
            label: doc.documentName,
            size: (doc.fileSize / 1024).toFixed(2) + ' KB',
            date: new Date(doc.uploadedAt).toLocaleDateString()
          };

          if (doc.documentType === 'EDU_10TH') files.edu_10th = fileData;
          else if (doc.documentType === 'EDU_12TH') files.edu_12th = fileData;
          else if (doc.documentType === 'GRADUATION') files.edu_grad = fileData;
          else if (doc.documentType === 'OTHER') files.educational.push(fileData);
          else if (doc.documentType === 'COURSE') files.course.push(fileData);
          else if (doc.documentType === 'TECHNICAL') files.technical.push(fileData);
          else if (doc.documentType === 'EMPLOYMENT') files.employment.push(fileData);
        });
        setUploadedFiles(files);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load your profile");
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    {
      id: "personal",
      label: "Personal Details",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )
    },
    {
      id: "emergency",
      label: "Emergency contact",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
      )
    },
    {
      id: "education",
      label: "Education details",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10L12 5L2 10L12 15L22 10Z"></path>
          <path d="M6 12V17C6 17 8 20 12 20C16 20 18 17 18 17V12"></path>
        </svg>
      )
    },
    {
      id: "employment",
      label: "Employment history",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      )
    },
    {
      id: "documents",
      label: "Documents",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    },
    {
      id: "leave_balance",
      label: "Leave Balance",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      )
    },
  ];

  const [uploadedFiles, setUploadedFiles] = useState({
    edu_10th: null,
    edu_12th: null,
    edu_grad: null,
    educational: [],
    course: [],
    technical: [],
    employment: []
  });

  const [otherEduLabel, setOtherEduLabel] = useState("");

  const convertDateToMonth = (dateValue) => {
    if (!dateValue) return '';
    if (dateValue.match(/^\d{4}-\d{2}$/)) return dateValue;
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) return dateValue.substring(0, 7);
    return dateValue;
  };

  const convertMonthToDate = (monthValue) => {
    if (!monthValue || !monthValue.trim()) return null;
    if (monthValue.match(/^\d{4}-\d{2}-\d{2}$/)) return monthValue;
    if (monthValue.match(/^\d{4}-\d{2}$/)) return monthValue + "-01";
    return null;
  };

  const handlePhotoUpload = (event) => {
    setPhotoError("");
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError("Only JPG, PNG, WEBP, or GIF files are allowed.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Profile photo must be smaller than 2MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedPhotoFile(file);
    setPhotoPreview(previewUrl);
    setPhotoDeleted(false);
  };

  const handlePhotoDelete = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview("");
    setPhotoDeleted(true);
    setPhotoError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const validateForm = () => {
    const errors = {};

    // Required fields:
    const firstNameVal = validateName(form.firstName);
    if (!firstNameVal.isValid) errors.firstName = firstNameVal.error;

    const lastNameVal = validateName(form.lastName);
    if (!lastNameVal.isValid) errors.lastName = lastNameVal.error;

    if (form.personalEmail && form.personalEmail.trim()) {
      const emailVal = validateEmail(form.personalEmail);
      if (!emailVal.isValid) errors.personalEmail = emailVal.error;
    }

    const mobileVal = validateMobileNumber(form.mobile, form.mobileCountryCode || '+91');
    if (!mobileVal.isValid) errors.mobile = mobileVal.error;

    const dobVal = validateDateOfBirth(form.dob);
    if (!dobVal.isValid) errors.dob = dobVal.error;

    if (!form.gender || !form.gender.trim()) {
      errors.gender = "Gender is required";
    }

    // Optional fields:
    if (form.middleName && form.middleName.trim()) {
      const val = validateName(form.middleName);
      if (!val.isValid) errors.middleName = val.error;
    }

    if (form.alternateMobile && form.alternateMobile.trim()) {
      const val = validateMobileNumber(form.alternateMobile, form.alternateMobileCountryCode || '+91');
      if (!val.isValid) errors.alternateMobile = val.error;
    }

    if (form.aadhar && form.aadhar.trim()) {
      const val = validateAadhaar(form.aadhar);
      if (!val.isValid) errors.aadhar = val.error;
    }

    if (form.pan && form.pan.trim()) {
      const val = validatePAN(form.pan);
      if (!val.isValid) errors.pan = val.error;
    }

    if (form.passport && form.passport.trim()) {
      const val = validatePassport(form.passport);
      if (!val.isValid) errors.passport = val.error;
    }

    if (form.currentAddress && form.currentAddress.trim()) {
      const val = validateAddress(form.currentAddress);
      if (!val.isValid) errors.currentAddress = val.error;
    }

    if (form.permanentAddress && form.permanentAddress.trim()) {
      const val = validateAddress(form.permanentAddress);
      if (!val.isValid) errors.permanentAddress = val.error;
    }

    if (form.emergencyContactName && form.emergencyContactName.trim()) {
      const val = validateName(form.emergencyContactName);
      if (!val.isValid) errors.emergencyContactName = val.error;
    }

    if (form.emergencyRelationship && form.emergencyRelationship.trim()) {
      const val = validateEmergencyRelationship(form.emergencyRelationship);
      if (!val.isValid) errors.emergencyRelationship = val.error;
    }

    if (form.emergencyPhone && form.emergencyPhone.trim()) {
      const val = validateMobileNumber(form.emergencyPhone, form.emergencyPhoneCountryCode || '+91');
      if (!val.isValid) errors.emergencyPhone = val.error;
    }

    if (form.emergencyAddress && form.emergencyAddress.trim()) {
      const val = validateAddress(form.emergencyAddress);
      if (!val.isValid) errors.emergencyAddress = val.error;
    }

    // Education validations
    if (form.education && Array.isArray(form.education)) {
      form.education.forEach((edu, idx) => {
        if (edu.startYear) {
          const sy = parseInt(edu.startYear);
          if (isNaN(sy) || sy < 1900 || sy > new Date().getFullYear() + 10) {
            errors[`edu_startYear_${idx}`] = "Enter a valid year";
          }
        }
        if (edu.endYear) {
          const ey = parseInt(edu.endYear);
          if (isNaN(ey) || ey < 1900 || ey > new Date().getFullYear() + 10) {
            errors[`edu_endYear_${idx}`] = "Enter a valid year";
          }
        }
        if (edu.startYear && edu.endYear) {
          const sy = parseInt(edu.startYear);
          const ey = parseInt(edu.endYear);
          if (!isNaN(sy) && !isNaN(ey) && ey < sy) {
            errors[`edu_endYear_${idx}`] = "End year cannot be before start year";
          }
        }
      });
    }

    // Employment validations
    if (form.employmentHistory && Array.isArray(form.employmentHistory)) {
      form.employmentHistory.forEach((exp, idx) => {
        if (exp.startDate && exp.endDate) {
          const sd = new Date(convertMonthToDate(exp.startDate));
          const ed = new Date(convertMonthToDate(exp.endDate));
          if (!isNaN(sd.getTime()) && !isNaN(ed.getTime()) && ed < sd) {
            errors[`exp_endDate_${idx}`] = "End date cannot be before start date";
          }
        }
        if (exp.reportingManagerEmail && exp.reportingManagerEmail.trim()) {
          const val = validateEmail(exp.reportingManagerEmail);
          if (!val.isValid) {
            errors[`exp_reportingManagerEmail_${idx}`] = val.error;
          }
        }
      });
    }

    return errors;
  };

  const handleEditToggle = async () => {
    if (editing) {
      // Run client-side validations before saving
      const errors = validateForm();
      const allTouched = {
        firstName: true, lastName: true, middleName: true, personalEmail: true,
        mobile: true, alternateMobile: true, dob: true, gender: true,
        maritalStatus: true, bloodGroup: true, aadhar: true, pan: true,
        passport: true, currentAddress: true, permanentAddress: true,
        emergencyContactName: true, emergencyRelationship: true,
        emergencyPhone: true, emergencyAddress: true
      };
      setTouched(allTouched);
      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        const errorFields = Object.keys(errors);
        let targetSection = null;
        const personalFields = ['firstName', 'lastName', 'personalEmail', 'mobile', 'alternateMobile', 'dob', 'gender', 'maritalStatus', 'bloodGroup', 'aadhar', 'pan', 'passport', 'currentAddress', 'permanentAddress'];
        const emergencyFields = ['emergencyContactName', 'emergencyRelationship', 'emergencyPhone', 'emergencyAddress'];

        if (errorFields.some(f => personalFields.includes(f))) {
          targetSection = "personal";
        } else if (errorFields.some(f => emergencyFields.includes(f))) {
          targetSection = "emergency";
        } else if (errorFields.some(f => f.startsWith('edu_'))) {
          targetSection = "education";
        } else if (errorFields.some(f => f.startsWith('exp_'))) {
          targetSection = "employment";
        }

        if (targetSection) setActiveSection(targetSection);
        alert("Please fix the validation errors before saving.");
        return;
      }

      try {
        setLoading(true);
        setPhotoError("");

        let photoPath = form.photoUrl || null;
        if (photoDeleted) {
          photoPath = null;
        } else if (selectedPhotoFile) {
          const formData = new FormData();
          formData.append('file', selectedPhotoFile);
          if (employee?.id) formData.append('employeeId', employee.id);

          const uploadRes = await api("/api/employees/upload-photo", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const errorJson = await uploadRes.json().catch(() => ({}));
            throw new Error(errorJson.message || "Photo upload failed");
          }

          const uploadJson = await uploadRes.json();
          photoPath = uploadJson.data;
        }

        const payload = {
          email: form.personalEmail || form.companyMail || employee?.email || "",
          firstName: form.firstName || employee?.firstName || "",
          middleName: form.middleName || employee?.middleName || "",
          lastName: form.lastName || employee?.lastName || "",
          phoneNumber: (form.mobileCountryCode || "+91") + (form.mobile || ""),
          alternatePhone: (form.alternateMobileCountryCode || "+91") + (form.alternateMobile || ""),
          dateOfBirth: form.dob || form.dateOfBirth || null,
          gender: form.gender || null,
          maritalStatus: form.maritalStatus || null,
          bloodGroup: form.bloodGroup || null,
          presentAddress: form.currentAddress || form.presentAddress || null,
          permanentAddress: form.permanentAddress || null,
          addressProof: form.aadhar ? 'Aadhar' : form.pan ? 'PAN' : form.addressProof || null,
          addressProofNumber: form.aadhar ? form.aadhar : form.pan ? form.pan : form.addressProofNumber || null,
          // PAN and Aadhaar now persist in their own columns so both save independently.
          panNo: form.pan || null,
          aadhaarNo: form.aadhar || null,
          passportNo: form.passport || null,
          emergencyContactName: form.emergencyContactName || null,
          emergencyRelationship: form.emergencyRelationship || null,
          emergencyPhone: (form.emergencyPhoneCountryCode || "+91") + (form.emergencyPhone || ""),
          emergencyAddress: form.emergencyAddress || null,
          educationList: Array.isArray(form.education) ? form.education : [],
          experienceList: Array.isArray(form.employmentHistory)
            ? form.employmentHistory.map(exp => ({
              ...exp,
              startDate: convertMonthToDate(exp.startDate),
              endDate: convertMonthToDate(exp.endDate)
            }))
            : [],
          photoPath,
          designation: form.role || null,
          corporateEmail: form.companyMail || null,
        };

        const res = await api(`/api/employees/${employee.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message || "Failed to save");
        }

        const json = await res.json();
        const updated = json.data || json || payload;
        setEmployee((p) => ({ ...p, ...updated, photoPath }));
        setForm((f) => ({ ...f, photoUrl: photoPath || "" }));
        setPhotoPreview(photoPath || "");
        setSelectedPhotoFile(null);
        setPhotoDeleted(false);
        setOriginalForm(null);
        setEditing(false);

        // Update localStorage for dashboard sync
        const storedUser = JSON.parse(localStorage.getItem("user")) || {};
        localStorage.setItem("user", JSON.stringify({
          ...storedUser,
          firstName: updated.firstName || storedUser.firstName,
          lastName: updated.lastName || storedUser.lastName,
          fullName: updated.firstName ? `${updated.firstName} ${updated.lastName}` : (storedUser.fullName || "Employee"),
          photoPath: photoPath === null ? null : photoPath || storedUser.photoPath,
          designation: updated.designation || storedUser.designation || storedUser.role
        }));

        // Notify the surrounding dashboard so the header ribbon (e.g. "Employee · Full Name")
        // refreshes immediately from the updated session — no re-login or page refresh.
        window.dispatchEvent(new Event("user-profile-updated"));

        // Re-fetch the saved record so the profile view reflects exactly what was
        // persisted (server-confirmed data, including newly added education/employment rows).
        await fetchEmpData();

        toast.success("Profile updated successfully");
      } catch (err) {
        toast.error("Failed to update profile. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      setOriginalForm(form);
      setFieldErrors({});
      setTouched({});
      setEditing(true);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    if (originalForm) setForm(originalForm);
    setOriginalForm(null);
    setSelectedPhotoFile(null);
    setPhotoPreview(employee?.photoPath || "");
    setPhotoDeleted(false);
    setPhotoError("");
    setFieldErrors({});
    setTouched({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let validatedValue = value;
    let error = null;

    // Country-code change for a mobile field: re-cap the number to the new country's limit
    if (['mobileCountryCode', 'alternateMobileCountryCode', 'emergencyPhoneCountryCode'].includes(name)) {
      const base = name.replace('CountryCode', '');
      const truncated = sanitizeMobileNumberByCountry(form[base] || '', value);
      setForm((f) => ({ ...f, [name]: value, [base]: truncated }));
      if (touched[base]) {
        const v = validateMobileNumber(truncated, value);
        setFieldErrors((prev) => ({ ...prev, [base]: v.error }));
      }
      return;
    }

    // Sanitize and validate based on field type
    if (['firstName', 'middleName', 'lastName', 'emergencyContactName'].includes(name)) {
      validatedValue = sanitizeName(value);
      if (name === 'middleName' && !validatedValue.trim()) {
        error = null;
      } else if (name === 'emergencyContactName' && !validatedValue.trim()) {
        error = null;
      } else {
        const validation = validateName(validatedValue);
        error = validation.error;
      }
    } else if (['mobile', 'alternateMobile', 'emergencyPhone'].includes(name)) {
      const countryCode = form[`${name}CountryCode`] || '+91';
      validatedValue = sanitizeMobileNumberByCountry(value, countryCode);
      if (['alternateMobile', 'emergencyPhone'].includes(name) && !validatedValue.trim()) {
        error = null;
      } else {
        const validation = validateMobileNumber(validatedValue, countryCode);
        error = validation.error;
      }
    } else if (name === 'aadhar') {
      validatedValue = value.replace(/\D/g, "").slice(0, 12);
      if (!validatedValue.trim()) {
        error = null;
      } else {
        const validation = validateAadhaar(validatedValue);
        error = validation.error;
      }
    } else if (name === 'pan') {
      validatedValue = sanitizePAN(value);
      if (!validatedValue.trim()) {
        error = null;
      } else {
        const validation = validatePAN(validatedValue);
        error = validation.error;
      }
    } else if (name === 'passport') {
      validatedValue = sanitizePassport(value);
      if (!validatedValue.trim()) {
        error = null;
      } else {
        const validation = validatePassport(validatedValue);
        error = validation.error;
      }
    } else if (['currentAddress', 'permanentAddress', 'emergencyAddress'].includes(name)) {
      validatedValue = value.slice(0, 252);
      if (!validatedValue.trim()) {
        error = null;
      } else {
        const validation = validateAddress(validatedValue);
        error = validation.error;
      }
    } else if (name === 'personalEmail') {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validateEmail(value);
        error = validation.error;
      }
    } else if (name === 'dob') {
      const validation = validateDateOfBirth(value);
      error = validation.error;
    } else if (name === 'emergencyRelationship') {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validateEmergencyRelationship(value);
        error = validation.error;
      }
    }

    setForm((f) => ({ ...f, [name]: validatedValue }));

    // Update error state if field has been touched
    if (touched[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    let error = null;
    if (['firstName', 'middleName', 'lastName', 'emergencyContactName'].includes(name)) {
      if (name === 'middleName' && !value.trim()) {
        error = null;
      } else if (name === 'emergencyContactName' && !value.trim()) {
        error = null;
      } else {
        const validation = validateName(value);
        error = validation.error;
      }
    } else if (['mobile', 'alternateMobile', 'emergencyPhone'].includes(name)) {
      const countryCode = form[`${name}CountryCode`] || '+91';
      if (['alternateMobile', 'emergencyPhone'].includes(name) && !value.trim()) {
        error = null;
      } else {
        const validation = validateMobileNumber(value, countryCode);
        error = validation.error;
      }
    } else if (name === 'aadhar') {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validateAadhaar(value);
        error = validation.error;
      }
    } else if (name === 'pan') {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validatePAN(value);
        error = validation.error;
      }
    } else if (name === 'passport') {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validatePassport(value);
        error = validation.error;
      }
    } else if (['currentAddress', 'permanentAddress', 'emergencyAddress'].includes(name)) {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validateAddress(value);
        error = validation.error;
      }
    } else if (name === 'personalEmail') {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validateEmail(value);
        error = validation.error;
      }
    } else if (name === 'dob') {
      const validation = validateDateOfBirth(value);
      error = validation.error;
    } else if (name === 'emergencyRelationship') {
      if (!value.trim()) {
        error = null;
      } else {
        const validation = validateEmergencyRelationship(value);
        error = validation.error;
      }
    }

    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleEducationChange = (index, field, value) => {
    const education = [...(form.education || [])];
    education[index] = { ...education[index], [field]: value };
    setForm({ ...form, education });

    // Validate on change
    let error = null;
    if (field === 'startYear') {
      const sy = parseInt(value);
      if (value && (isNaN(sy) || sy < 1900 || sy > new Date().getFullYear() + 10)) {
        error = "Enter a valid year";
      }
    } else if (field === 'endYear') {
      const ey = parseInt(value);
      if (value && (isNaN(ey) || ey < 1900 || ey > new Date().getFullYear() + 10)) {
        error = "Enter a valid year";
      }
      const sy = parseInt(education[index].startYear);
      if (value && sy && !isNaN(sy) && !isNaN(ey) && ey < sy) {
        error = "End year cannot be before start year";
      }
    }
    setFieldErrors(prev => ({ ...prev, [`edu_${field}_${index}`]: error }));
  };

  const addEducation = () => {
    setForm({
      ...form,
      education: [...(form.education || []), { institutionName: "", degreeLevel: "", startYear: "", endYear: "" }]
    });
  };

  const removeEducation = (index) => {
    const education = [...(form.education || [])];
    education.splice(index, 1);
    setForm({ ...form, education });
  };

  const handleEmploymentChange = (index, field, value) => {
    const employmentHistory = [...(form.employmentHistory || [])];
    employmentHistory[index] = { ...employmentHistory[index], [field]: value };
    setForm({ ...form, employmentHistory });

    // Validate on change
    let error = null;
    if (field === 'reportingManagerEmail') {
      if (value && value.trim()) {
        const val = validateEmail(value);
        error = val.error;
      }
    } else if (field === 'endDate') {
      const sd = convertMonthToDate(employmentHistory[index].startDate);
      const ed = convertMonthToDate(value);
      if (value && sd && new Date(ed) < new Date(sd)) {
        error = "End date cannot be before start date";
      }
    }
    setFieldErrors(prev => ({ ...prev, [`exp_${field}_${index}`]: error }));
  };

  const addEmployment = () => {
    setForm({
      ...form,
      employmentHistory: [...(form.employmentHistory || []), {
        employerName: "", businessType: "", designation: "", startDate: "", endDate: "",
        employerAddress: "", reportingManagerName: "", reportingManagerEmail: ""
      }]
    });
  };

  const removeEmployment = (index) => {
    const employmentHistory = [...(form.employmentHistory || [])];
    employmentHistory.splice(index, 1);
    setForm({ ...form, employmentHistory });
  };

  const handleFileUpload = async (category, event, isFixed = false) => {
    const file = event.target.files[0];
    if (file) {
      let finalLabel = "";
      let docType = "";

      if (isFixed) {
        if (category === 'edu_10th') { finalLabel = '10th Standard'; docType = 'EDU_10TH'; }
        else if (category === 'edu_12th') { finalLabel = '12th / Diploma'; docType = 'EDU_12TH'; }
        else if (category === 'edu_grad') { finalLabel = 'Graduation'; docType = 'GRADUATION'; }
      } else {
        if (category === 'educational') {
          if (!otherEduLabel.trim()) { alert("Please enter the Degree Name before uploading."); return; }
          finalLabel = otherEduLabel;
          docType = 'OTHER';
        } else if (category === 'technical') {
          const label = window.prompt("Please enter the name for this Technical Certification:");
          if (!label || !label.trim()) return;
          finalLabel = label.trim();
          docType = 'TECHNICAL';
        } else if (category === 'employment') {
          const label = window.prompt("Please enter the name for this Employment Certification/Letter:");
          if (!label || !label.trim()) return;
          finalLabel = label.trim();
          docType = 'EMPLOYMENT';
        } else if (category === 'course') {
          const label = window.prompt("Please enter the name for this Course Certification:");
          if (!label || !label.trim()) return;
          finalLabel = label.trim();
          docType = 'COURSE';
        }
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType);
      formData.append('documentName', finalLabel);
      if (employee?.id) formData.append('employeeId', employee.id);

      try {
        const res = await api("/api/documents/upload", {
          method: "POST",
          body: formData
        });

        if (!res.ok) throw new Error("Upload failed");

        const json = await res.json();
        const savedDoc = json.data;

        const newFile = {
          id: savedDoc.id,
          name: savedDoc.fileName,
          size: (savedDoc.fileSize / 1024).toFixed(2) + ' KB',
          date: new Date(savedDoc.uploadedAt).toLocaleDateString(),
          type: savedDoc.contentType,
          preview: savedDoc.fileUrl,
          label: savedDoc.documentName
        };

        if (isFixed) {
          setUploadedFiles(prev => ({ ...prev, [category]: newFile }));
        } else {
          setUploadedFiles(prev => ({ ...prev, [category]: [...prev[category], newFile] }));
          if (category === 'educational') setOtherEduLabel("");
        }
      } catch (err) {
        alert(err.message);
      }
      event.target.value = null;
    }
  };

  const removeFile = async (category, index = -1) => {
    const fileToRemove = index === -1 ? uploadedFiles[category] : uploadedFiles[category][index];
    if (!fileToRemove || !fileToRemove.id) return;
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await api(`/api/documents/${fileToRemove.id}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Delete failed");

      if (index === -1) {
        setUploadedFiles(prev => ({ ...prev, [category]: null }));
      } else {
        setUploadedFiles(prev => ({ ...prev, [category]: prev[category].filter((_, i) => i !== index) }));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const navItems = user.role === "REPORTING_MANAGER" ? [
    { tab: "dashboard", label: "Dashboard", to: "/manager", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { tab: "team", label: "My Team", to: "/reporting-team", icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg> },
    { tab: "profile", label: "My Profile", to: "/employee/profile", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
  ] : [
    { tab: "dashboard", label: "Dashboard", to: user.role === 'HR' ? "/hr" : "/employee", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { tab: "profile", label: "My Profile", to: "/employee/profile", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { tab: "timesheet", label: "Time Sheet", to: "/employee/timesheet", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  ];

  if (user.role === 'HR') {
    navItems.push({
      tab: "actions",
      label: "Actions",
      to: "/hr/actions",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12" y2="16"></line>
        </svg>
      ),
    });
  }

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const currentPhotoSrc = photoDeleted ? "" : (photoPreview || form.photoUrl || employee?.photoPath || "");

  const roleBadgeLabel =
    user.role === 'HR' ? 'HR Manager'
      : user.role === 'REPORTING_MANAGER' ? 'Reporting Manager'
        : 'Employee';

  const getInitials = () => {
    const f = (employee?.firstName || '').trim().charAt(0);
    const l = (employee?.lastName || '').trim().charAt(0);
    return (f + l).toUpperCase() || 'U';
  };

  const activeSectionLabel = sections.find((s) => s.id === activeSection)?.label || '';

  return (
    <div className={hideSidebar ? "w-full" : "flex h-screen w-screen bg-[#F7F5FA] overflow-hidden"}>
      {!hideSidebar && (
        <Sidebar
          activeTab="profile"
          navItems={navItems}
          handleLogout={handleLogout}
        />
      )}

      <main className={hideSidebar ? "flex-1 overflow-y-auto" : "flex-1 overflow-y-auto p-4 lg:p-8"}>
        <div className="max-w-6xl mx-auto space-y-4 lg:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <aside className="lg:col-span-1">
              <div className="bg-[#F8F7F4] rounded-2xl border border-black/5 p-5 lg:sticky lg:top-4">
                <div className="flex flex-col items-center text-center pb-5 border-b border-black/5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-brand-blue text-white text-2xl font-semibold shadow-md ring-4 ring-white">
                      {currentPhotoSrc ? (
                        <img src={currentPhotoSrc} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span>{getInitials()}</span>
                      )}
                    </div>
                    {editing && (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md ring-2 ring-white hover:bg-brand-blue-hover transition-all"
                          aria-label="Change profile photo"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                        </button>
                        {currentPhotoSrc && (
                          <button
                            type="button"
                            onClick={handlePhotoDelete}
                            className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-white text-red-500 flex items-center justify-center shadow-md ring-2 ring-white hover:bg-red-50 transition-all"
                            aria-label="Remove profile photo"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                    <input id="profilePhotoInput" ref={fileInputRef} type="file" className="hidden" onChange={handlePhotoUpload} accept="image/jpeg,image/png,image/webp,image/gif" />
                  </div>
                  {photoError && <p className="text-[11px] text-red-500 mt-2">{photoError}</p>}
                  <h2 className="mt-3 text-[18px] font-medium text-brand-text leading-tight">{employee?.firstName} {employee?.lastName}</h2>
                  <p className="text-[13px] text-brand-text/50 mt-0.5">{form.role || employee?.designation || "VisionAi Team"}</p>
                  <span className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-[11px] font-semibold">{roleBadgeLabel}</span>
                </div>

                <nav className="mt-4 flex lg:flex-col gap-1 overflow-x-auto">
                  {sections.map((s) => {
                    const active = activeSection === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-[13px] whitespace-nowrap border-l-[3px] ${active
                          ? 'border-brand-blue bg-white text-brand-blue font-semibold shadow-sm'
                          : 'border-transparent text-brand-text/50 font-medium hover:bg-white/60 hover:text-brand-text'}`}
                      >
                        <span className={`shrink-0 ${active ? 'text-brand-blue' : 'text-brand-text/40'}`}>{s.icon}</span>
                        {s.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden min-h-[600px]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 lg:px-10 py-5 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-brand-text">{activeSectionLabel}</h2>
                  <div className="flex items-center gap-2">
                    {/* Edit Profile is hidden on the read-only Leave Balance tab; Back stays. */}
                    {activeSection === 'leave_balance' ? null : !editing ? (
                      <button
                        onClick={handleEditToggle}
                        className="px-5 py-2 bg-brand-blue text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-brand-blue-hover transition-all"
                      >
                        Edit Profile
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleEditToggle}
                          className="px-5 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-green-600 transition-all"
                        >
                          {loading ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          className="px-4 py-2 bg-white text-brand-text text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="px-4 py-2 bg-white text-brand-text/70 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
                    >
                      Back
                    </button>
                  </div>
                </div>
                {loading && !editing ? (
                  <div className="p-20 flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-brand-text/40 font-bold uppercase tracking-widest text-xs">Loading Profile...</p>
                  </div>
                ) : (
                  <div className={`p-4 lg:p-10 ${editing ? 'profile-editing' : ''}`}>
                    {activeSection === 'personal' && (
                      <div className="space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                          <div className="sm:col-span-2 space-y-2">
                            <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">Full Name</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <input name="firstName" value={form.firstName || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing} maxLength="32" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.firstName && touched.firstName ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`} placeholder="Enter first name" />
                                {fieldErrors.firstName && touched.firstName && <FormFieldError error={fieldErrors.firstName} show={true} />}
                              </div>
                              <div>
                                <input name="middleName" value={form.middleName || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing} maxLength="32" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.middleName && touched.middleName ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`} placeholder="Enter middle name (optional)" />
                                {fieldErrors.middleName && touched.middleName && <FormFieldError error={fieldErrors.middleName} show={true} />}
                              </div>
                              <div>
                                <input name="lastName" value={form.lastName || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing} maxLength="32" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.lastName && touched.lastName ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`} placeholder="Enter last name" />
                                {fieldErrors.lastName && touched.lastName && <FormFieldError error={fieldErrors.lastName} show={true} />}
                              </div>
                            </div>
                          </div>
                          {[
                            { label: 'Company ID', name: 'companyId', disabled: true },
                            { label: 'Corporate Email', name: 'companyMail', disabled: true },
                            { label: 'Joining Date', name: 'joiningDate', type: 'date', disabled: true },
                            { label: 'Personal Email', name: 'personalEmail' },
                            { label: 'Mobile No', name: 'mobile' },
                            { label: 'Alternate Mobile', name: 'alternateMobile' },
                            { label: 'Date of Birth', name: 'dob', type: 'date' },
                            { label: 'Gender', name: 'gender' },
                            { label: 'Marital Status', name: 'maritalStatus' },
                            { label: 'Blood Group', name: 'bloodGroup' },
                            { label: 'Aadhar No', name: 'aadhar' },
                            { label: 'PAN No', name: 'pan' },
                            { label: 'Passport No', name: 'passport' },
                          ].map((field) => {
                            const isDropdown = ['gender', 'maritalStatus'].includes(field.name);
                            const isDisabled = !editing || field.disabled;
                            const maxLengths = { aadhar: 12, pan: 10, passport: 9 };

                            return (
                              <div key={field.name} className="space-y-2">
                                <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">{field.label}</label>
                                {isDropdown ? (
                                  <select
                                    name={field.name}
                                    value={form[field.name] || ''}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    disabled={isDisabled}
                                    className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${isDisabled ? 'cursor-not-allowed opacity-80' : ''}`}
                                  >
                                    <option value="">Select {field.label}</option>
                                    {field.name === 'gender' ? (
                                      <>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                      </>
                                    ) : (
                                      <>
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                      </>
                                    )}
                                  </select>
                                ) : ['mobile', 'alternateMobile'].includes(field.name) ? (
                                  <div>
                                    <div className="flex gap-1">
                                      <select
                                        name={`${field.name}CountryCode`}
                                        value={form[`${field.name}CountryCode`] || '+91'}
                                        onChange={handleChange}
                                        disabled={isDisabled}
                                        className={`w-28 bg-[#F8F7F4] border-none rounded-xl px-2 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${isDisabled ? 'cursor-not-allowed opacity-80' : ''}`}
                                      >
                                        <option value="+91">+91 (IN)</option>
                                        <option value="+81">+81 (JP)</option>
                                      </select>
                                      <input
                                        type={field.type || "text"}
                                        name={field.name}
                                        value={form[field.name] || ''}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        disabled={isDisabled}
                                        inputMode="numeric"
                                        maxLength={getMobileMaxDigits(form[`${field.name}CountryCode`] || '+91')}
                                        className={`flex-1 bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${isDisabled ? 'cursor-not-allowed opacity-80' : ''}`}
                                      />
                                    </div>
                                    {fieldErrors[field.name] && touched[field.name] && <FormFieldError error={fieldErrors[field.name]} show={true} />}
                                  </div>
                                ) : (
                                  <div>
                                    <input
                                      type={field.type || "text"}
                                      name={field.name}
                                      value={form[field.name] || ''}
                                      onChange={handleChange}
                                      onBlur={handleBlur}
                                      disabled={isDisabled}
                                      maxLength={maxLengths[field.name] || 100}
                                      className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${isDisabled ? 'cursor-not-allowed opacity-80' : ''}`}
                                    />
                                    {fieldErrors[field.name] && touched[field.name] && <FormFieldError error={fieldErrors[field.name]} show={true} />}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <div className="sm:col-span-2 space-y-2">
                            <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">Current Address</label>
                            <textarea
                              name="currentAddress"
                              value={form.currentAddress || ''}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              disabled={!editing}
                              rows="2"
                              maxLength="252"
                              className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.currentAddress && touched.currentAddress ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
                            />
                            {fieldErrors.currentAddress && touched.currentAddress && <FormFieldError error={fieldErrors.currentAddress} show={true} />}
                            <CharacterCounter current={(form.currentAddress || '').length} max={252} />
                          </div>
                          <div className="sm:col-span-2 space-y-2">
                            <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">Permanent Address</label>
                            <textarea
                              name="permanentAddress"
                              value={form.permanentAddress || ''}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              disabled={!editing}
                              rows="2"
                              maxLength="252"
                              placeholder="Enter permanent address"
                              className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.permanentAddress && touched.permanentAddress ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
                            />
                            {fieldErrors.permanentAddress && touched.permanentAddress && <FormFieldError error={fieldErrors.permanentAddress} show={true} />}
                            <CharacterCounter current={(form.permanentAddress || '').length} max={252} />
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSection === 'emergency' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: 'Contact Name', name: 'emergencyContactName', type: 'text' },
                          { label: 'Relationship', name: 'emergencyRelationship', type: 'select' },
                          { label: 'Phone Number', name: 'emergencyPhone', type: 'phone' },
                        ].map((field) => (
                          <div key={field.name} className="space-y-2">
                            <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">{field.label}</label>
                            {field.name === 'emergencyPhone' ? (
                              <div>
                                <div className="flex gap-1">
                                  <select
                                    name="emergencyPhoneCountryCode"
                                    value={form.emergencyPhoneCountryCode || '+91'}
                                    onChange={handleChange}
                                    disabled={!editing}
                                    className={`w-28 bg-[#F8F7F4] border-none rounded-xl px-2 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${(!editing) ? 'cursor-not-allowed opacity-80' : ''}`}
                                  >
                                    <option value="+91">+91 (IN)</option>
                                  </select>
                                  <input
                                    name={field.name}
                                    value={form[field.name] || ''}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    disabled={!editing}
                                    inputMode="numeric"
                                    maxLength={getMobileMaxDigits(form.emergencyPhoneCountryCode || '+91')}
                                    className={`flex-1 bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${(!editing) ? 'cursor-not-allowed opacity-80' : ''}`}
                                  />
                                </div>
                                {fieldErrors[field.name] && touched[field.name] && <FormFieldError error={fieldErrors[field.name]} show={true} />}
                              </div>
                            ) : field.type === 'select' ? (
                              <div>
                                <select
                                  name={field.name}
                                  value={form[field.name] || ''}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  disabled={!editing}
                                  className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
                                >
                                  <option value="">Select Relationship</option>
                                  {EMERGENCY_RELATIONSHIPS.map((rel) => (
                                    <option key={rel} value={rel}>{rel}</option>
                                  ))}
                                </select>
                                {fieldErrors[field.name] && touched[field.name] && (
                                  <FormFieldError error={fieldErrors[field.name]} show={true} />
                                )}
                              </div>
                            ) : (
                              <div>
                                <input
                                  name={field.name}
                                  value={form[field.name] || ''}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  disabled={!editing}
                                  maxLength="100"
                                  className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
                                />
                                {fieldErrors[field.name] && touched[field.name] && (
                                  <FormFieldError error={fieldErrors[field.name]} show={true} />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className="sm:col-span-2 space-y-2">
                          <label className="text-xs font-bold text-brand-text/40 uppercase tracking-widest ml-1">Address</label>
                          <textarea
                            name="emergencyAddress"
                            value={form.emergencyAddress || ''}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            disabled={!editing}
                            rows="3"
                            maxLength="252"
                            className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.emergencyAddress && touched.emergencyAddress ? 'ring-2 ring-red-500 bg-red-50' : ''} ${!editing ? 'cursor-not-allowed opacity-80' : ''}`}
                          />
                          {fieldErrors.emergencyAddress && touched.emergencyAddress && (
                            <FormFieldError error={fieldErrors.emergencyAddress} show={true} />
                          )}
                          <CharacterCounter current={(form.emergencyAddress || '').length} max={252} />
                        </div>
                      </div>
                    )}

                    {activeSection === 'education' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xl font-bold text-brand-text">Educational Qualifications</h3>
                          {editing && (
                            <button onClick={addEducation} className="px-4 py-1.5 bg-brand-blue-dark text-white rounded-lg text-xs font-bold hover:bg-brand-blue-hover transition-all">+ Add New</button>
                          )}
                        </div>
                        <div className="space-y-4">
                          {(form.education || []).map((edu, idx) => (
                            <div key={idx} className="bg-gray-50 p-6 rounded-2xl relative border border-brand-blue/5">
                              {editing && <button onClick={() => removeEducation(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-500 font-bold text-xs uppercase transition-all">Remove</button>}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Institution</label>
                                  <input value={edu.institutionName || ''} onChange={(e) => handleEducationChange(idx, 'institutionName', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Degree</label>
                                  <input value={edu.degreeLevel || ''} onChange={(e) => handleEducationChange(idx, 'degreeLevel', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Start Year</label>
                                  <input type="number" value={edu.startYear || ''} onChange={(e) => handleEducationChange(idx, 'startYear', e.target.value)} disabled={!editing} className={`w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text ${fieldErrors[`edu_startYear_${idx}`] ? 'ring-2 ring-red-500 bg-red-50' : ''}`} />
                                  {fieldErrors[`edu_startYear_${idx}`] && <p className="text-red-500 text-[10px] font-bold mt-1">{fieldErrors[`edu_startYear_${idx}`]}</p>}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">End Year</label>
                                  <input type="number" value={edu.endYear || ''} onChange={(e) => handleEducationChange(idx, 'endYear', e.target.value)} disabled={!editing} className={`w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text ${fieldErrors[`edu_endYear_${idx}`] ? 'ring-2 ring-red-500 bg-red-50' : ''}`} />
                                  {fieldErrors[`edu_endYear_${idx}`] && <p className="text-red-500 text-[10px] font-bold mt-1">{fieldErrors[`edu_endYear_${idx}`]}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!form.education || form.education.length === 0) && (
                            <div className="text-center py-20 text-brand-text/20 font-bold uppercase tracking-widest">No education details added</div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeSection === 'employment' && (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xl font-bold text-brand-text">Work Experience</h3>
                          {editing && (
                            <button onClick={addEmployment} className="px-4 py-1.5 bg-brand-blue-dark text-white rounded-lg text-xs font-bold hover:bg-brand-blue-hover transition-all">+ Add Gap / Job</button>
                          )}
                        </div>
                        <div className="space-y-4">
                          {(form.employmentHistory || []).map((exp, idx) => (
                            <div key={idx} className="bg-gray-50 p-6 rounded-2xl relative border border-brand-blue/5">
                              {editing && <button onClick={() => removeEmployment(idx)} className="absolute top-4 right-4 text-red-400 hover:text-red-500 font-bold text-xs uppercase transition-all">Remove</button>}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Company Name</label>
                                  <input value={exp.employerName || ''} onChange={(e) => handleEmploymentChange(idx, 'employerName', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Designation</label>
                                  <input value={exp.designation || ''} onChange={(e) => handleEmploymentChange(idx, 'designation', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Business Type</label>
                                  <input value={exp.businessType || ''} onChange={(e) => handleEmploymentChange(idx, 'businessType', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Start Date</label>
                                  <input type="month" value={exp.startDate || ''} onChange={(e) => handleEmploymentChange(idx, 'startDate', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">End Date</label>
                                  <input type="month" value={exp.endDate || ''} onChange={(e) => handleEmploymentChange(idx, 'endDate', e.target.value)} disabled={!editing} className={`w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text ${fieldErrors[`exp_endDate_${idx}`] ? 'ring-2 ring-red-500 bg-red-50' : ''}`} />
                                  {fieldErrors[`exp_endDate_${idx}`] && <p className="text-red-500 text-[10px] font-bold mt-1">{fieldErrors[`exp_endDate_${idx}`]}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!form.employmentHistory || form.employmentHistory.length === 0) && (
                            <div className="text-center py-20 text-brand-text/20 font-bold uppercase tracking-widest">No work history added</div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeSection === 'documents' && (
                      <div className="space-y-8">
                        <div className="bg-gray-50 rounded-2xl p-6 border border-brand-blue/5">
                          <div className="mb-6">
                            <h3 className="text-xl font-bold text-brand-text">Educational Certifications</h3>
                            <p className="text-xs text-brand-text/40 font-medium">Your uploaded academic records</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { id: 'edu_10th', label: '10th Standard' },
                              { id: 'edu_12th', label: '12th / Diploma' },
                              { id: 'edu_grad', label: 'Graduation' }
                            ].map((edu) => (
                              <div key={edu.id} className="bg-white p-4 rounded-xl border border-brand-blue/5 flex flex-col gap-3 shadow-sm relative group">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-brand-text">{edu.label}</span>
                                  {editing && (
                                    !uploadedFiles[edu.id] ? (
                                      <label className="cursor-pointer text-brand-text hover:text-brand-yellow transition-all">
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                          <polyline points="17 8 12 3 7 8"></polyline>
                                          <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(edu.id, e, true)} accept=".pdf,.jpg,.jpeg,.png" />
                                      </label>
                                    ) : (
                                      <button onClick={() => removeFile(edu.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg">
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <polyline points="3 6 5 6 21 6"></polyline>
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                      </button>
                                    )
                                  )}
                                </div>
                                <div className="h-[100px] flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden border border-dashed border-brand-blue/10 relative cursor-pointer" onClick={() => uploadedFiles[edu.id] && window.open(uploadedFiles[edu.id].preview, '_blank')}>
                                  {uploadedFiles[edu.id] ? (
                                    <>
                                      {uploadedFiles[edu.id].type.startsWith('image/') ? (
                                        <img src={uploadedFiles[edu.id].preview} alt={edu.label} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="flex flex-col items-center justify-center text-brand-text/40">
                                          <svg className="w-8 h-8 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                            <polyline points="14 2 14 8 20 8"></polyline>
                                          </svg>
                                          <span className="text-[9px] font-bold text-center px-2 break-all line-clamp-2">{uploadedFiles[edu.id].name}</span>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-brand-blue/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-widest">VIEW</div>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-brand-text/20 font-bold uppercase tracking-widest italic">Not Uploaded</span>
                                  )}
                                </div>
                              </div>
                            ))}
                            <div className="bg-white p-4 rounded-xl border border-brand-blue/5 flex flex-col gap-3 shadow-sm">
                              <span className="text-sm font-bold text-brand-text">Others / Miscellaneous</span>
                              {editing && (
                                <div className="flex gap-2">
                                  <input placeholder="Enter document name (e.g. Intern Letter)" className="flex-1 text-[11px] p-2 bg-gray-50 rounded-lg outline-none" value={otherEduLabel} onChange={(e) => setOtherEduLabel(e.target.value)} />
                                  <label className="cursor-pointer bg-brand-blue-dark text-white p-2 rounded-lg hover:bg-brand-blue-hover transition-all">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    <input type="file" className="hidden" onChange={(e) => handleFileUpload('educational', e)} accept=".pdf,.jpg,.jpeg,.png" />
                                  </label>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {uploadedFiles.educational.map((file, idx) => (
                                  <div key={file.id} className="group relative w-12 h-12 rounded bg-gray-100 border border-brand-blue/5 flex items-center justify-center cursor-pointer" onClick={() => window.open(file.preview, '_blank')}>
                                    <span className="text-[8px] font-bold text-brand-text/40">{file.label.substring(0, 3)}...</span>
                                    {editing && (
                                      <button onClick={(e) => { e.stopPropagation(); removeFile('educational', idx); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {['technical', 'employment', 'course'].map((cat) => (
                          <div key={cat} className="bg-white rounded-2xl p-6 border border-brand-blue/5 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                              <h3 className="text-xl font-bold text-brand-text capitalize">{cat} Certifications</h3>
                              {editing && (
                                <label className="cursor-pointer bg-brand-blue-dark text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-brand-blue-hover transition-all flex items-center gap-2">
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                  Upload New
                                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(cat, e)} accept=".pdf,.jpg,.jpeg,.png" />
                                </label>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                              {uploadedFiles[cat].map((file, idx) => (
                                <div key={file.id} className="relative group aspect-square rounded-xl bg-gray-50 border border-brand-blue/5 overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all" onClick={() => window.open(file.preview, '_blank')}>
                                  {file.type.startsWith('image/') ? (
                                    <img src={file.preview} alt={file.label} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                      <svg className="w-10 h-10 text-brand-text/20 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                      <span className="text-[10px] font-bold text-brand-text text-center line-clamp-2">{file.label}</span>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-brand-blue/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                                    <div className="flex gap-2">
                                      {editing && (
                                        <button onClick={(e) => { e.stopPropagation(); removeFile(cat, idx); }} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-lg transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                      )}
                                      <button className="bg-white text-brand-text p-2 rounded-lg transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {uploadedFiles[cat].length === 0 && (
                                <div className="col-span-full h-24 flex items-center justify-center border-2 border-dashed border-brand-blue/5 rounded-xl">
                                  <p className="text-[10px] text-brand-text/10 font-bold uppercase tracking-widest">No certifications</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeSection === 'leave_balance' && (
                      <div className="space-y-8">
                        <div className="mb-6">
                          <h3 className="text-base font-medium text-brand-text">Leave Balance</h3>
                          <p className="text-xs text-brand-text/60 font-normal">Your currently available leaves</p>
                        </div>

                        {fetchingBalance ? (
                          <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
                          </div>
                        ) : leaveBalance ? (
                          <>
                            {leaveBalance.onProbation && (
                              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <line x1="12" y1="8" x2="12" y2="12"></line>
                                  <line x1="12" y1="16" x2="12" y2="16"></line>
                                </svg>
                                <div>
                                  <p className="text-[11px] font-black text-red-600 uppercase tracking-widest">You are on probation</p>
                                  <p className="text-[10px] font-bold text-red-600/80 mt-1 leading-relaxed">
                                    No paid leaves are allocated during the first 6 months from your joining date.
                                    {leaveBalance.probationEndDate && (
                                      <> Probation ends on <span className="font-black">{new Date(leaveBalance.probationEndDate).toLocaleDateString('en-GB')}</span>.</>
                                    )}
                                    {' '}Any leave taken now will be treated as <span className="font-black">Loss of Pay (LOP)</span>.
                                  </p>
                                </div>
                              </div>
                            )}
                            {/* Flat single row of 5 equal columns, divided by thin vertical lines. */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                              {[
                                { label: 'Casual & Earned Leaves', total: leaveBalance.casualLeavesTotal, used: leaveBalance.casualLeavesUsed, carry: leaveBalance.casualLeavesCarriedForward, barColor: 'bg-blue-500' },
                                { label: 'Sick Leaves', total: leaveBalance.sickLeavesTotal, used: leaveBalance.sickLeavesUsed, barColor: 'bg-red-500' },
                                { label: 'Maternity Leaves', total: leaveBalance.maternityLeavesTotal, used: leaveBalance.maternityLeavesUsed, barColor: 'bg-brand-blue-dark' },
                                { label: 'Paternity Leaves', total: leaveBalance.paternityLeavesTotal, used: leaveBalance.paternityLeavesUsed, barColor: 'bg-brand-blue-dark' },
                                { label: 'Bereavement Leaves', total: leaveBalance.bereavementLeavesTotal, used: leaveBalance.bereavementLeavesUsed, barColor: 'bg-brand-blue-dark' },
                              ].map((leave, idx) => {
                                const total = (leave.total || 0) + (leave.carry || 0);
                                const used = leave.used || 0;
                                const left = total - used;
                                const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                                return (
                                  <div
                                    key={leave.label}
                                    className={`px-5 py-4 ${idx > 0 ? 'lg:border-l-[0.5px] lg:border-gray-200' : ''}`}
                                  >
                                    <p className="text-[13px] font-medium text-brand-text leading-snug">{leave.label}</p>
                                    <div className="mt-3">
                                      <span className="text-[28px] font-medium text-brand-text leading-none">{left.toFixed(2)}</span>
                                      <span className="text-[11px] text-brand-text/40 ml-1">Days</span>
                                    </div>
                                    <p className="text-[11px] text-brand-text/40 mt-0.5">left</p>
                                    <div className="w-full bg-gray-200 rounded-[2px] h-1 mt-3 overflow-hidden">
                                      <div
                                        className={`${leave.barColor} h-full rounded-[2px] transition-all duration-500`}
                                        style={{ width: `${pct}%` }}
                                      ></div>
                                    </div>
                                    <div className="mt-2 space-y-0.5 text-right">
                                      <p className="text-[11px] text-brand-text/40">
                                        {leave.carry > 0
                                          ? `Total: ${(leave.total || 0).toFixed(0)} + ${leave.carry.toFixed(1)} carried`
                                          : `Total: ${total.toFixed(2)}`}
                                      </p>
                                      <p className="text-[11px] text-brand-text/40">Used: {used.toFixed(2)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="bg-gray-50 rounded-2xl p-12 text-center border border-dashed border-brand-blue/10">
                            <p className="text-brand-text/40 font-bold uppercase tracking-widest text-xs">No leave balance data found</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}




