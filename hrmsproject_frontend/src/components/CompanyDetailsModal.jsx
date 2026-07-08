import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { validateEmail } from "../utils/formValidation";
import { FormFieldError } from "./FormValidation";

export default function CompanyDetailsModal({ open, onClose, onSave }) {
    const [employees, setEmployees] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [formData, setFormData] = useState({
        oryfolksId: "",
        oryfolksMailId: "",
        designation: "",
        joiningDate: ""
    });
    const [saving, setSaving] = useState(false);

    const fetchEmployeesWithoutDetails = async () => {
        setLoading(true);
        try {
            const res = await api("/api/company-details/missing");
            const json = await res.json();
            setEmployees(json.data || []);
        } catch (err) {
            console.error("Failed to fetch employees", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchEmployeesWithoutDetails();
            setSelectedEmployee(null);
            setFormData({ oryfolksId: "", oryfolksMailId: "", designation: "", joiningDate: "" });
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [open]);

    const handleEmployeeClick = (emp) => {
        setSelectedEmployee(emp);
        setFormData({
            oryfolksId: "",
            oryfolksMailId: emp.email || "",
            designation: "",
            joiningDate: ""
        });
    };

    const handleSave = async () => {
        if (!selectedEmployee) return;
        setSaving(true);
        try {
            const res = await api(`/api/company-details/${selectedEmployee.id}`, {
                method: "POST",
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                alert("Company details added successfully!");
                fetchEmployeesWithoutDetails();
                setSelectedEmployee(null);
                if (onSave) onSave();
            } else {
                const error = await res.json();
                alert("Error: " + (error.message || "Failed to save"));
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const emailValidation = validateEmail(formData.oryfolksMailId);
    const emailError = formData.oryfolksMailId && !emailValidation.isValid ? emailValidation.error : null;

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in scale-in duration-200">
            <div className="absolute inset-0 bg-brand-blue/60 backdrop-blur-sm" onClick={onClose} />

            <div className="bg-brand-card w-full max-w-5xl h-[90vh] md:h-[85vh] rounded-3xl md:rounded-[2rem] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row border border-brand-blue/5 transition-all duration-200 modal-scale">

                {/* Left Sidebar */}
                <div className="w-full md:w-80 h-1/3 md:h-full bg-white border-r border-brand-blue/5 flex flex-col">
                    <div className="p-6 border-b border-brand-blue/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-brand-text">Members</h3>
                            <span className="bg-brand-yellow/20 text-brand-text text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                {employees.length} Pending
                            </span>
                        </div>
                        <div className="relative">
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-text/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input
                                type="text"
                                placeholder="Search by name or ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-40 space-y-3 opacity-40">
                                <div className="w-8 h-8 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-text/50">Loading...</span>
                            </div>
                        ) : filteredEmployees.length === 0 ? (
                            <div className="py-20 text-center px-4">
                                <p className="text-brand-text/40 text-sm font-bold">No members found</p>
                            </div>
                        ) : (
                            filteredEmployees.map((emp) => (
                                <button
                                    key={emp.id}
                                    onClick={() => handleEmployeeClick(emp)}
                                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${selectedEmployee?.id === emp.id
                                        ? 'bg-brand-yellow text-brand-text shadow-md'
                                        : 'hover:bg-gray-50 text-brand-text/70'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center font-bold ${selectedEmployee?.id === emp.id ? 'bg-white/40 text-brand-text' : 'bg-brand-blue/5 text-brand-text/40'
                                        }`}>
                                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                                    </div>
                                    <div className="text-left overflow-hidden">
                                        <div className="text-sm font-bold truncate">{emp.firstName} {emp.lastName}</div>
                                        <div className={`text-[10px] font-bold truncate ${selectedEmployee?.id === emp.id ? 'text-brand-text/60' : 'text-brand-text/30'}`}>
                                            {emp.email}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel */}
                <div className="flex-1 flex flex-col h-2/3 md:h-full overflow-hidden">
                    <header className="p-6 bg-white border-b border-brand-blue/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-blue/5 text-brand-text rounded-xl">
                                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-brand-text tracking-tight">VisionAi Identity</h2>
                                <p className="text-brand-text/40 text-[10px] font-bold uppercase tracking-widest">Assign Corporate Profile</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-all text-brand-text/40">
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </header>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {!selectedEmployee ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                                <div className="w-20 h-20 bg-brand-blue/5 rounded-full flex items-center justify-center animate-pulse text-brand-text/20">
                                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-lg font-bold text-brand-text uppercase tracking-tight">Select a Member</h4>
                                    <p className="text-xs font-bold text-brand-text/40 uppercase tracking-widest">Choose from the left sidebar to proceed</p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-300">

                                <div className="p-6 rounded-3xl bg-brand-blue-dark text-white shadow-xl relative overflow-hidden">
                                    <div className="absolute -top-10 -right-10 opacity-10">
                                        <svg className="w-40 h-40" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                                    </div>
                                    <div className="relative z-10 flex items-center gap-6">
                                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl font-bold border border-white/20">
                                            {selectedEmployee.firstName?.[0]}{selectedEmployee.lastName?.[0]}
                                        </div>
                                        <div>
                                            <div className="text-xl font-bold tracking-tight">{selectedEmployee.firstName} {selectedEmployee.lastName}</div>
                                            <div className="text-white/40 text-xs font-bold uppercase tracking-wider">{selectedEmployee.email}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-brand-text/40 uppercase tracking-widest ml-1">Company ID</label>
                                            <input
                                                type="text"
                                                value={formData.oryfolksId}
                                                onChange={(e) => setFormData({ ...formData, oryfolksId: e.target.value.toUpperCase() })}
                                                placeholder="Enter company ID"
                                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-brand-text/40 uppercase tracking-widest ml-1">Designation</label>
                                            <input
                                                type="text"
                                                value={formData.designation}
                                                onChange={(e) => setFormData({ ...formData, designation: e.target.value.replace(/[^a-zA-Z\s]/g, "") })}
                                                placeholder="Enter designation (e.g. ASE, SSE)"
                                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-brand-text/40 uppercase tracking-widest ml-1">VisionAi Mail ID</label>
                                            <input
                                                type="email"
                                                value={formData.oryfolksMailId}
                                                onChange={(e) => setFormData({ ...formData, oryfolksMailId: e.target.value })}
                                                placeholder="Enter corporate email address"
                                                className={`w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all outline-none ${emailError ? 'ring-2 ring-red-500 bg-red-50' : ''}`}
                                            />
                                            <FormFieldError error={emailError} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-brand-text/40 uppercase tracking-widest ml-1">Joining Date</label>
                                            <input
                                                type="date"
                                                value={formData.joiningDate}
                                                onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-yellow/50 transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 flex items-center justify-between border-t border-brand-blue/5">
                                    <button
                                        onClick={() => setSelectedEmployee(null)}
                                        className="text-[10px] font-bold text-brand-text/30 uppercase tracking-[0.2em] hover:text-red-400 transition-colors"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving || !formData.oryfolksId || !formData.oryfolksMailId || !formData.designation || !formData.joiningDate || !!emailError}
                                        className={`px-8 py-3 bg-brand-yellow text-brand-text rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg transition-all ${saving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
                                            }`}
                                    >
                                        {saving ? 'Saving...' : 'Confirm Details'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #dfe6f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}} />
        </div>
    );
}




