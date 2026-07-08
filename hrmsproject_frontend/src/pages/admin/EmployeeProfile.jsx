import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Logo from '../../assets/visionai-logo.png';
import AdminSidebar from "../../components/AdminSidebar";
import Sidebar from "../../components/Sidebar";
import { getHrNavItems } from "../../utils/hrNav";
import { getRmNavItems } from "../../utils/rmNav";
import api from "../../utils/api";
import NotificationComponent from "../../components/NotificationComponent";
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

export default function EmployeeProfile() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("personal");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [user, setUser] = useState({});
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Disabled accounts are strictly read-only: editing can never be entered.
  const isReadOnly = employee?.active === false;


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

  // Document Upload State
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

  // Helper functions for date format conversion
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

  useEffect(() => {
    const fetchEmp = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api(`/api/employees/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Failed to load employee");
        }
        const json = await res.json();
        const data = json.data || json || {};
        setEmployee(data);

        // Populate form
        setForm({
          role: data.designation || "Candidate",
          companyMail: data.corporateEmail || "",
          personalEmail: data.email || "",
          companyId: data.oryfolksId || "",
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
          joiningDate: data.joiningDate || "",
        });

        // Populate documents
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
        setError(err.message || "Failed to load employee");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchEmp();
  }, [id]);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setUser(userData);

    const handleClickOutside = (event) => {
      if (!event.target.closest("#profile-dropdown-container")) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  useEffect(() => {
    const fetchLeaveBalance = async () => {
      if (activeSection === 'leave_balance' && id && !leaveBalance) {
        setFetchingBalance(true);
        try {
          const res = await api(`/api/leaves/balance/${id}`);
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
  }, [activeSection, id, leaveBalance]);



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
      const validation = validateName(validatedValue);
      error = validation.error;
    } else if (['mobile', 'alternateMobile', 'emergencyPhone'].includes(name)) {
      const countryCode = form[`${name}CountryCode`] || '+91';
      validatedValue = sanitizeMobileNumberByCountry(value, countryCode);
      const validation = validateMobileNumber(validatedValue, countryCode);
      error = validation.error;
    } else if (name === 'aadhar') {
      validatedValue = value.replace(/\D/g, "").slice(0, 12);
      const validation = validateAadhaar(validatedValue);
      error = validation.error;
    } else if (name === 'pan') {
      validatedValue = sanitizePAN(value);
      const validation = validatePAN(validatedValue);
      error = validation.error;
    } else if (name === 'passport') {
      validatedValue = sanitizePassport(value);
      const validation = validatePassport(validatedValue);
      error = validation.error;
    } else if (['currentAddress', 'permanentAddress', 'emergencyAddress'].includes(name)) {
      validatedValue = value.slice(0, 252);
      if (value.trim()) {
        const validation = validateAddress(validatedValue);
        error = validation.error;
      }
    } else if (name === 'personalEmail') {
      const validation = validateEmail(value);
      error = validation.error;
    } else if (name === 'dob') {
      const validation = validateDateOfBirth(value);
      error = validation.error;
    } else if (name === 'emergencyRelationship') {
      const validation = validateEmergencyRelationship(value);
      error = validation.error;
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

    // Validate on blur
    let error = null;
    if (['firstName', 'middleName', 'lastName', 'emergencyContactName'].includes(name)) {
      const validation = validateName(value);
      error = validation.error;
    } else if (['mobile', 'alternateMobile', 'emergencyPhone'].includes(name)) {
      const countryCode = form[`${name}CountryCode`] || '+91';
      const validation = validateMobileNumber(value, countryCode);
      error = validation.error;
    } else if (name === 'aadhar') {
      const validation = validateAadhaar(value);
      error = validation.error;
    } else if (name === 'pan') {
      const validation = validatePAN(value);
      error = validation.error;
    } else if (name === 'passport') {
      const validation = validatePassport(value);
      error = validation.error;
    } else if (['currentAddress', 'permanentAddress', 'emergencyAddress'].includes(name)) {
      if (value.trim()) {
        const validation = validateAddress(value);
        error = validation.error;
      }
    } else if (name === 'personalEmail') {
      const validation = validateEmail(value);
      error = validation.error;
    } else if (name === 'dob') {
      const validation = validateDateOfBirth(value);
      error = validation.error;
    } else if (name === 'emergencyRelationship') {
      const validation = validateEmergencyRelationship(value);
      error = validation.error;
    }

    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };

  // Education/Employment Handlers (simplified for brevity, similar to original)
  const handleEducationChange = (index, field, value) => {
    const education = [...(form.education || [])];
    education[index] = { ...education[index], [field]: value };
    setForm({ ...form, education });
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

  // Document Handlers
  const triggerUploadFlow = (categoryId) => {
    const input = document.getElementById(`file-input-${categoryId}`);
    if (input) input.click();
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
      formData.append('employeeId', id); // Important: pass employeeId for Admin upload

      try {
        const res = await api("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Upload failed");
        }

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

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', id);

      try {
        const res = await api("/api/employees/upload-photo", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Photo upload failed");

        const json = await res.json();
        const photoPath = json.data;
        setForm(f => ({ ...f, photoUrl: photoPath }));
        setEmployee(p => ({ ...p, photoPath }));
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const removeFile = async (category, index = -1) => {
    const fileToRemove = index === -1 ? uploadedFiles[category] : uploadedFiles[category][index];
    if (!fileToRemove || !fileToRemove.id) return;
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await api(`/api/documents/${fileToRemove.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Delete failed");
      }

      if (index === -1) {
        setUploadedFiles(prev => ({ ...prev, [category]: null }));
      } else {
        setUploadedFiles(prev => ({ ...prev, [category]: prev[category].filter((_, i) => i !== index) }));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditToggle = async () => {
    if (editing) {
      try {
        setLoading(true);
        const payload = {
          email: form.personalEmail || employee?.email || "",
          firstName: form.firstName || employee?.firstName || "",
          middleName: form.middleName || employee?.middleName || "",
          lastName: form.lastName || employee?.lastName || "",
          phoneNumber: (form.mobileCountryCode || "+91") + (form.mobile || ""),
          alternatePhone: (form.alternateMobileCountryCode || "+91") + (form.alternateMobile || ""),
          dateOfBirth: form.dob || null,
          gender: form.gender || null,
          maritalStatus: form.maritalStatus || null,
          bloodGroup: form.bloodGroup || null,
          presentAddress: form.currentAddress || null,
          permanentAddress: form.permanentAddress || null,
          addressProof: form.aadhar ? 'Aadhar' : form.pan ? 'PAN' : (employee?.addressProof || null),
          addressProofNumber: form.aadhar ? form.aadhar : form.pan ? form.pan : (employee?.addressProofNumber || null),
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
          photoPath: form.photoUrl || employee?.photoPath || null,
          designation: form.role || null,
          corporateEmail: form.companyMail || null,
          oryfolksId: form.companyId || null,
          joiningDate: form.joiningDate || null,
        };

        const res = await api(`/api/employees/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message || "Failed to save");
        }

        const json = await res.json();
        const updated = json.data || json || payload;
        setEmployee((p) => ({ ...p, ...updated }));
        setEditing(false);
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      setEditing(true);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const userRole = JSON.parse(localStorage.getItem("user"))?.role;

  const currentPhotoSrc = form.photoUrl || employee?.photoPath || "";
  const canEditProfile = (userRole === "ADMIN" || userRole === "HR") && !isReadOnly;

  const getInitials = () => {
    const f = (employee?.firstName || '').trim().charAt(0);
    const l = (employee?.lastName || '').trim().charAt(0);
    return (f + l).toUpperCase() || 'U';
  };

  const viewedRoleBadge =
    employee?.role === 'HR' ? 'HR Manager'
      : employee?.role === 'REPORTING_MANAGER' ? 'Reporting Manager'
        : employee?.role === 'ADMIN' ? 'Admin'
          : 'Employee';

  const activeSectionLabel = sections.find((s) => s.id === activeSection)?.label || '';

  return (
    <div className="flex h-screen w-screen bg-[#F7F5FA] overflow-hidden">
      {userRole === "HR" ? (
        <Sidebar
          activeTab="candidates"
          setActiveTab={() => { }}
          handleLogout={handleLogout}
          navItems={getHrNavItems()}
          hideLogout={true}
        />
      ) : userRole === "REPORTING_MANAGER" ? (
        <Sidebar
          activeTab="team"
          setActiveTab={() => { }}
          handleLogout={handleLogout}
          navItems={getRmNavItems()}
          hideLogout={true}
        />
      ) : (
        <AdminSidebar
          activeTab="candidates"
          onLogout={handleLogout}
        />
      )}


      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold text-brand-text">
                  {employee ? `${employee.firstName} ${employee.lastName}` : "Candidate Profile"}
                </h1>
                <p className="text-brand-text/60 font-medium tracking-tight mt-1">
                  Management console for {form.role || "team member"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* <div className="flex items-center gap-3 relative" id="profile-dropdown-container">
                <NotificationComponent />
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="w-10 h-10 rounded-full border-2 border-brand-blue/10 overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center bg-white p-0"
                  title="View Profile"
                >
                  {user.photoPath ? (
                    <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-brand-text/20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  )}
                </button>

                {/* Dropdown Menu *
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-brand-blue/5 py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
                    <button
                      onClick={() => {
                        if (user.role === "REPORTING_MANAGER") {
                          navigate("/reporting-dashboard?tab=profile");
                        } else if (user.role === "HR") {
                          navigate("/hr?tab=profile");
                        } else if (user.role === "ADMIN") {
                          navigate("/admin");
                        }
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-brand-text hover:bg-bg-slate transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      My Profile
                    </button>
                    <div className="h-px bg-brand-blue/5 mx-2 my-1"></div>
                    <button
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div> */}

              <div className="h-8 w-px bg-brand-blue/10 mx-1"></div>

              <div className="flex items-center gap-3">
                {(userRole === "ADMIN" || userRole === "HR") && !isReadOnly && (
                  <button
                    onClick={handleEditToggle}
                    className={`px-6 py-2 ${editing ? 'bg-green-500' : 'bg-brand-blue'} text-white font-semibold rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center gap-2 whitespace-nowrap`}
                  >
                    {loading && editing ? "Saving..." : (editing ? "Save Changes" : "Edit Profile")}
                  </button>
                )}

                <button
                  onClick={() => navigate(-1)}
                  className="px-4 py-2 bg-white text-brand-text font-bold rounded-xl border border-brand-blue/10 hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  Back
                </button>
              </div>
            </div>
          </header>

          {isReadOnly && (
            <div className="flex items-center gap-3 bg-gray-100 border border-gray-300 rounded-2xl px-5 py-4 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-gray-300 flex items-center justify-center text-gray-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-black text-gray-700 uppercase tracking-tight">Disabled Account — Read Only</p>
                <p className="text-[11px] font-bold text-gray-500 mt-0.5">This employee is disabled. All details are view-only and cannot be edited.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Navigation Tabs */}
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
                    {editing && canEditProfile && (
                      <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-md ring-2 ring-white hover:bg-brand-blue-hover transition-all cursor-pointer" aria-label="Change profile photo">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                          <circle cx="12" cy="13" r="4"></circle>
                        </svg>
                        <input type="file" className="hidden" onChange={handlePhotoUpload} accept="image/*" />
                      </label>
                    )}
                  </div>
                  <h2 className="mt-3 text-[18px] font-medium text-brand-text leading-tight">{employee?.firstName} {employee?.lastName}</h2>
                  <p className="text-[13px] text-brand-text/50 mt-0.5">{form.role || employee?.designation || "Designation"}</p>
                  <span className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full bg-brand-blue/10 text-brand-blue text-[11px] font-semibold">{viewedRoleBadge}</span>
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

            {/* Main Content Area */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 lg:px-8 py-5 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-brand-text">{activeSectionLabel}</h2>
                </div>
                <div className={`p-8 ${editing ? 'profile-editing' : ''}`}>
                  {activeSection === 'personal' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">Full Name</label>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <input name="firstName" value={form.firstName || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing} maxLength="32" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all placeholder:text-brand-text/20 ${fieldErrors.firstName && touched.firstName ? 'ring-2 ring-red-500 bg-red-50' : ''}`} placeholder="Enter first name" />
                              {fieldErrors.firstName && touched.firstName && <FormFieldError error={fieldErrors.firstName} show={true} />}
                            </div>
                            <div>
                              <input name="middleName" value={form.middleName || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing} maxLength="32" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all placeholder:text-brand-text/20 ${fieldErrors.middleName && touched.middleName ? 'ring-2 ring-red-500 bg-red-50' : ''}`} placeholder="Enter middle name (optional)" />
                              {fieldErrors.middleName && touched.middleName && <FormFieldError error={fieldErrors.middleName} show={true} />}
                            </div>
                            <div>
                              <input name="lastName" value={form.lastName || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing} maxLength="32" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all placeholder:text-brand-text/20 ${fieldErrors.lastName && touched.lastName ? 'ring-2 ring-red-500 bg-red-50' : ''}`} placeholder="Enter last name" />
                              {fieldErrors.lastName && touched.lastName && <FormFieldError error={fieldErrors.lastName} show={true} />}
                            </div>
                          </div>
                        </div>

                        {[
                          { label: 'Designation', name: 'role' },
                          { label: 'Company ID', name: 'companyId' },
                          { label: 'Corporate Email', name: 'companyMail' },
                          { label: 'Joining Date', name: 'joiningDate', type: 'date' },
                          { label: 'Personal Email', name: 'personalEmail' },
                          { label: 'Mobile No', name: 'mobile' },
                          { label: 'Date of Birth', name: 'dob', type: 'date' },
                          { label: 'Gender', name: 'gender' },
                          { label: 'Marital Status', name: 'maritalStatus' },
                          { label: 'Blood Group', name: 'bloodGroup' },
                          { label: 'Aadhar No', name: 'aadhar' },
                          { label: 'PAN No', name: 'pan' },
                          { label: 'Passport No', name: 'passport' },
                        ].map((field) => {
                          const isAdminField = ['role', 'companyId', 'companyMail', 'joiningDate'].includes(field.name);
                          const isDisabled = !editing || (userRole === 'HR' && isAdminField);
                          const isDropdown = ['gender', 'maritalStatus'].includes(field.name);
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
                                  className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                      className={`w-28 bg-[#F8F7F4] border-none rounded-xl px-2 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                      className={`flex-1 bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                    className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                  />
                                  {fieldErrors[field.name] && touched[field.name] && <FormFieldError error={fieldErrors[field.name]} show={true} />}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">Current Address</label>
                          <textarea name="currentAddress" value={form.currentAddress || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing || userRole === 'ADMIN'} rows="2" maxLength="252" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.currentAddress && touched.currentAddress ? 'ring-2 ring-red-500 bg-red-50' : ''} ${(!editing || userRole === 'ADMIN') ? 'opacity-60 cursor-not-allowed' : ''}`} />
                          {fieldErrors.currentAddress && touched.currentAddress && <FormFieldError error={fieldErrors.currentAddress} show={true} />}
                          <CharacterCounter current={(form.currentAddress || '').length} max={252} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">Permanent Address</label>
                          <textarea name="permanentAddress" value={form.permanentAddress || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing || userRole === 'ADMIN'} rows="2" maxLength="252" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.permanentAddress && touched.permanentAddress ? 'ring-2 ring-red-500 bg-red-50' : ''} ${(!editing || userRole === 'ADMIN') ? 'opacity-60 cursor-not-allowed' : ''}`} />
                          {fieldErrors.permanentAddress && touched.permanentAddress && <FormFieldError error={fieldErrors.permanentAddress} show={true} />}
                          <CharacterCounter current={(form.permanentAddress || '').length} max={252} />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === 'emergency' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { label: 'Contact Name', name: 'emergencyContactName' },
                        { label: 'Relationship', name: 'emergencyRelationship' },
                        { label: 'Phone Number', name: 'emergencyPhone' },
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
                                  className={`w-28 bg-[#F8F7F4] border-none rounded-xl px-2 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${(!editing) ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                  maxLength={getMobileMaxDigits(form[`${field.name}CountryCode`] || '+91')}
                                  className={`flex-1 bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${(!editing) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                              </div>
                              {fieldErrors[field.name] && touched[field.name] && <FormFieldError error={fieldErrors[field.name]} show={true} />}
                            </div>
                          ) : field.name === 'emergencyRelationship' ? (
                            <div>
                              <select
                                name={field.name}
                                value={form[field.name] || ''}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                disabled={!editing}
                                className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${(!editing) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <option value="">Select Relationship</option>
                                {EMERGENCY_RELATIONSHIPS.map((rel) => (
                                  <option key={rel} value={rel}>{rel}</option>
                                ))}
                              </select>
                              {fieldErrors[field.name] && touched[field.name] && <FormFieldError error={fieldErrors[field.name]} show={true} />}
                            </div>
                          ) : (
                            <div>
                              <input
                                name={field.name}
                                value={form[field.name] || ''}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                disabled={!editing}
                                maxLength="32"
                                className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors[field.name] && touched[field.name] ? 'ring-2 ring-red-500 bg-red-50' : ''} ${(!editing) ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                              {fieldErrors[field.name] && touched[field.name] && <FormFieldError error={fieldErrors[field.name]} show={true} />}
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-[11px] font-bold text-brand-text/50 uppercase tracking-[0.06em] ml-1">Address</label>
                        <textarea name="emergencyAddress" value={form.emergencyAddress || ''} onChange={handleChange} onBlur={handleBlur} disabled={!editing} rows="3" maxLength="252" className={`w-full bg-[#F8F7F4] border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all ${fieldErrors.emergencyAddress && touched.emergencyAddress ? 'ring-2 ring-red-500 bg-red-50' : ''} ${(!editing) ? 'opacity-60 cursor-not-allowed' : ''}`} />
                        {fieldErrors.emergencyAddress && touched.emergencyAddress && <FormFieldError error={fieldErrors.emergencyAddress} show={true} />}
                        <CharacterCounter current={(form.emergencyAddress || '').length} max={252} />
                      </div>
                    </div>
                  )}

                  {activeSection === 'education' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-brand-text">Educational Qualifications</h3>
                        {editing && (
                          <button onClick={addEducation} className="btn-primary py-2 text-xs">+ Add New</button>
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
                                <input type="number" value={edu.startYear || ''} onChange={(e) => handleEducationChange(idx, 'startYear', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">End Year</label>
                                <input type="number" value={edu.endYear || ''} onChange={(e) => handleEducationChange(idx, 'endYear', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSection === 'employment' && (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-brand-text">Work Experience</h3>
                        {editing && (
                          <button onClick={addEmployment} className="btn-primary py-2 text-xs">+ Add Career Gap / Job</button>
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
                                <input type="month" value={exp.endDate || ''} onChange={(e) => handleEmploymentChange(idx, 'endDate', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                              </div>
                              <div className="md:col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Employer Address</label>
                                <textarea value={exp.employerAddress || ''} onChange={(e) => handleEmploymentChange(idx, 'employerAddress', e.target.value)} disabled={!editing} rows="2" className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Reporting Manager</label>
                                <input value={exp.reportingManagerName || ''} onChange={(e) => handleEmploymentChange(idx, 'reportingManagerName', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Manager Email</label>
                                <input value={exp.reportingManagerEmail || ''} onChange={(e) => handleEmploymentChange(idx, 'reportingManagerEmail', e.target.value)} disabled={!editing} className="w-full bg-white border-none rounded-lg px-3 py-2 text-sm font-bold text-brand-text" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSection === 'documents' && (
                    <div className="space-y-8">
                      <div className="bg-gray-50 rounded-2xl p-6 border border-brand-blue/5">
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-brand-text">Educational Certifications</h3>
                          <p className="text-xs text-brand-text/40 font-medium">Verified academic records</p>
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
                                  <span className="text-[10px] text-brand-text/20 font-bold uppercase tracking-widest italic">Empty</span>
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
                            <div>
                              <h3 className="text-xl font-bold text-brand-text capitalize">{cat} Certifications</h3>
                              <p className="text-xs text-brand-text/40 font-medium whitespace-nowrap overflow-hidden text-ellipsis">Manage {cat} certificates</p>
                            </div>
                            {editing && (
                              <label className="cursor-pointer btn-primary py-2 text-xs flex items-center gap-2">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Upload
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
                                  <span className="text-white text-[10px] font-bold text-center mb-2 line-clamp-2">{file.label}</span>
                                  <div className="flex gap-2">
                                    {editing && (
                                      <button onClick={(e) => { e.stopPropagation(); removeFile(cat, idx); }} className="bg-red-500/80 hover:bg-red-500 text-white p-2 rounded-lg transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                    )}
                                    <button className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeSection === 'leave_balance' && (
                    <div className="space-y-8">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold text-brand-text">Leave Balance</h3>
                        <p className="text-xs text-brand-text/40 font-medium">Currently available leaves for this employee</p>
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
                                <p className="text-[11px] font-black text-red-600 uppercase tracking-widest">Employee is on probation</p>
                                <p className="text-[10px] font-bold text-red-600/80 mt-1 leading-relaxed">
                                  No paid leaves are allocated during the first 6 months from joining.
                                  {leaveBalance.probationEndDate && (
                                    <> Probation ends on <span className="font-black">{new Date(leaveBalance.probationEndDate).toLocaleDateString('en-GB')}</span>.</>
                                  )}
                                  {' '}Any leave applied for now will be treated as <span className="font-black">LOP</span>.
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                              { label: 'Casual & Earned Leaves', total: leaveBalance.casualLeavesTotal, used: leaveBalance.casualLeavesUsed, carry: leaveBalance.casualLeavesCarriedForward, color: 'bg-brand-yellow' },
                              { label: 'Sick Leaves', total: leaveBalance.sickLeavesTotal, used: leaveBalance.sickLeavesUsed, color: 'bg-red-500' },
                              { label: 'Maternity Leaves', total: leaveBalance.maternityLeavesTotal, used: leaveBalance.maternityLeavesUsed, color: 'bg-brand-blue-hover' },
                              { label: 'Paternity Leaves', total: leaveBalance.paternityLeavesTotal, used: leaveBalance.paternityLeavesUsed, color: 'bg-brand-blue-dark' },
                              { label: 'Bereavement Leaves', total: leaveBalance.bereavementLeavesTotal, used: leaveBalance.bereavementLeavesUsed, color: 'bg-brand-yellow-hover' },
                            ].map((leave) => {
                              const total = (leave.total || 0) + (leave.carry || 0);
                              const used = leave.used || 0;
                              const left = total - used;
                              return (
                                <div key={leave.label} className="bg-gray-50 rounded-2xl p-6 border border-brand-blue/5 shadow-sm space-y-4">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-brand-text">{leave.label}</span>
                                    <div className={`${leave.color} w-3 h-3 rounded-full shadow-sm`}></div>
                                  </div>
                                  <div className="flex items-end justify-between">
                                    <div>
                                      <span className="text-3xl font-bold text-brand-text">{left.toFixed(2)}</span>
                                      <span className="text-xs font-bold text-brand-text/40 ml-1">Days left</span>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">
                                        {leave.carry > 0
                                          ? `Total: ${(leave.total || 0).toFixed(0)} + ${leave.carry.toFixed(1)} carried`
                                          : `Total: ${total.toFixed(2)}`}
                                      </p>
                                      <p className="text-[10px] font-bold text-brand-text/30 uppercase tracking-widest">Used: {used.toFixed(2)}</p>
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`${leave.color} h-full transition-all duration-500`}
                                      style={{ width: `${total > 0 ? Math.min(100, (used / total) * 100) : 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="bg-gray-50 rounded-2xl p-12 text-center border border-dashed border-brand-blue/10">
                          <p className="text-brand-text/40 font-bold uppercase tracking-widest text-xs">No leave balance data found</p>
                          <button
                            onClick={async () => {
                              try {
                                const res = await api(`/api/leaves/balance/initialize/${id}`, {
                                  method: 'POST',
                                });
                                if (res.ok) {
                                  const json = await res.json();
                                  setLeaveBalance(json.data);
                                }
                              } catch (err) {
                                alert("Failed to initialize leave balance");
                              }
                            }}
                            className="mt-4 px-6 py-2 bg-brand-blue-dark text-white font-bold rounded-xl hover:bg-brand-blue-hover transition-all text-sm"
                          >
                            Initialize Balance
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



