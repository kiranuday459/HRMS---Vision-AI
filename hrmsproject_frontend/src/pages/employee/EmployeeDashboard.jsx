import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../utils/api";

import LeaveRequestPage from "./LeaveRequestPage";
import PersonalTimesheetContent from "./PersonalTimesheetContent";
import EmployeeOwnProfile from "./EmployeeOwnProfile";
import Sidebar from '../../components/Sidebar';
import { Eye } from "lucide-react";
import LeaveDetailsModal from "../../components/LeaveDetailsModal";
import NotificationComponent from "../../components/NotificationComponent";
import { ROLE_LABELS, resolveHeading } from "../../config/pageHeadings";
import { getLeaveActionLabel } from "../../utils/leaveStatus";
import { getWeekStatus } from "../../utils/timesheetStatus";
import { useClientAccess } from "../../hooks/useClientAccess";
import ClientOtpVerifyModal from "../../components/ClientOtpVerifyModal";

const EmployeeDashboard = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [activeTab, setActiveTab] = useState("dashboard");
	const [user, setUser] = useState({});
	const [currentDate, setCurrentDate] = useState("");
	const [employeeId, setEmployeeId] = useState(null); // Added state
	const [leaveBalance, setLeaveBalance] = useState(null);
	const [recentLeaves, setRecentLeaves] = useState([]);
	const [recentTimesheets, setRecentTimesheets] = useState([]);
	const [expandedWeek, setExpandedWeek] = useState(null);
	const [loading, setLoading] = useState(true);
	const [timesheetLoading, setTimesheetLoading] = useState(false);
	const [error, setError] = useState("");
	const [selectedLeave, setSelectedLeave] = useState(null);
	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
	const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	// Client Timesheet access (assignment + OTP verification) — drives the activation banner
	// and the conditional sidebar button.
	const { clientAssigned, clientVerified, clientProject, refresh: refreshClientAccess } = useClientAccess();
	const [otpModalOpen, setOtpModalOpen] = useState(false);

	const headingSection = { dashboard: 'dashboard', timesheet: 'timesheet', leave: 'leave', profile: 'profile' }[activeTab];

	// Ribbon mirrors the page heading: same central config, keyed by the active tab.
	const ribbonSection = headingSection;
	const ribbonUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}") || {}; } catch { return {}; } })();
	const ribbonTitle = resolveHeading(ribbonUser.role, ribbonSection);
	const ribbonRoleLabel = ROLE_LABELS[ribbonUser.role] || ribbonUser.role || "";
	const ribbonName = ribbonUser.fullName || `${ribbonUser.firstName || ""} ${ribbonUser.lastName || ""}`.trim();

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const tabParam = params.get("tab");
		if (tabParam && ["dashboard", "timesheet", "leave", "profile"].includes(tabParam)) {
			setActiveTab(tabParam);
		}
	}, [location.search]);

	// Sync user data from localStorage when switching back to dashboard
	useEffect(() => {
		const userData = JSON.parse(localStorage.getItem("user")) || {};
		setUser(userData);
	}, [activeTab]);

	// Refresh Client Timesheet access on landing here (login uses client-side navigation, so
	// the provider — mounted before login — hasn't fetched with the new token yet).
	useEffect(() => {
		refreshClientAccess();
	}, [refreshClientAccess]);

	// Refresh the header ribbon immediately after a profile save (no re-login/refresh).
	useEffect(() => {
		const syncUser = () => {
			try { setUser(JSON.parse(localStorage.getItem("user")) || {}); } catch { /* ignore */ }
		};
		window.addEventListener("user-profile-updated", syncUser);
		return () => window.removeEventListener("user-profile-updated", syncUser);
	}, []);

	useEffect(() => {
		const userData = JSON.parse(localStorage.getItem("user")) || {};
		setUser(userData);

		const today = new Date();
		const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
		setCurrentDate(today.toLocaleDateString('en-GB', options));

		// Fetch correct employee ID first
		fetchEmployeeProfile();

		// Click outside to close dropdown
		const handleClickOutside = (event) => {
			if (!event.target.closest("#profile-dropdown-container")) {
				setIsProfileDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const fetchEmployeeProfile = async () => {
		try {
			const response = await api("/api/me/employee");

			if (response.ok) {
				const result = await response.json();
				const employeeData = result.data || result;

				if (employeeData && employeeData.id) {
					console.log("Fetched correct employee ID:", employeeData.id);
					setEmployeeId(employeeData.id);

					// Sync back to user state and storage
					const storedUser = JSON.parse(localStorage.getItem("user")) || {};
					const newUser = {
						...storedUser,
						employeeId: employeeData.id,
						firstName: employeeData.firstName || storedUser.firstName,
						lastName: employeeData.lastName || storedUser.lastName,
						photoPath: employeeData.photoPath || storedUser.photoPath,
						designation: employeeData.designation || storedUser.designation || "Team Member",
						companyMail: employeeData.corporateEmail || storedUser.companyMail || "",
						reportingManagerName: employeeData.reportingManagerName || storedUser.reportingManagerName || "N/A",
						hrName: employeeData.hrName || storedUser.hrName || "N/A",
						// Track whether the RM/HR accounts are disabled so we can show "(Disabled)" beside their name.
						reportingManagerActive: employeeData.reportingManagerActive,
						hrActive: employeeData.hrActive,
						fullName: employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName}` : (storedUser.fullName || "Employee")
					};
					setUser(newUser);
					localStorage.setItem("user", JSON.stringify(newUser));

					fetchLeaveData(employeeData.id);
					fetchTimesheetData(employeeData.id);
				} else {
					setError("User profile is missing employee details");
					setLoading(false);
				}
			} else {
				const errorData = await response.json().catch(() => ({}));
				setError(errorData.message || "User details are not loaded. Please re-login.");
				setLoading(false);
			}
		} catch (err) {
			console.error("Error fetching employee profile:", err);
			setError("Connection error. Could not load user details.");
			setLoading(false);
		}
	};

	const fetchLeaveData = async (employeeId) => {
		try {
			setLoading(true);

			// Fetch leave balance
			const balanceResponse = await api(`/api/leaves/balance/${employeeId}`);

			if (balanceResponse.ok) {
				const balanceData = await balanceResponse.json();
				setLeaveBalance(balanceData.data);
			}

			// Fetch all leaves, sorted by newest first
			const allLeavesResponse = await api(`/api/leaves/employee/${employeeId}`);

			if (allLeavesResponse.ok) {
				const allLeavesData = await allLeavesResponse.json();
				let allLeaves = allLeavesData.data || [];
				// Sort by submittedAt or startDate, newest first
				allLeaves = allLeaves.sort((a, b) => {
					const dateA = a.submittedAt || a.startDate;
					const dateB = b.submittedAt || b.startDate;
					return new Date(dateB) - new Date(dateA);
				});
				setRecentLeaves(allLeaves);
			}

			setError("");
		} catch (err) {
			console.error("Error fetching leave data:", err);
			setError("Failed to load leave information");
		} finally {
			setLoading(false);
		}
	};

	const groupIntoWeeksSummary = (data) => {
		const weeksMap = {};

		const getSaturday = (dateStr) => {
			const d = new Date(dateStr);
			const day = d.getDay();
			const diff = d.getDate() - day + (day === 6 ? 0 : -1);
			const sat = new Date(d.setDate(diff));
			sat.setHours(0, 0, 0, 0);
			return sat;
		};

		const formatShortDate = (date) => {
			return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
		};

		data.forEach(entry => {
			const sat = getSaturday(entry.date);
			const weekKey = sat.toISOString().split('T')[0];

			if (!weeksMap[weekKey]) {
				const fri = new Date(sat);
				fri.setDate(sat.getDate() + 6);
				weeksMap[weekKey] = {
					weekKey,
					start: sat,
					end: fri,
					startDateStr: formatShortDate(sat),
					endDateStr: formatShortDate(fri),
					totalHours: 0,
					status: 'NOT_FILLED',
					statusLabel: 'Not Filled',
					entries: []
				};
			}

			const week = weeksMap[weekKey];
			week.entries.push(entry);
			week.totalHours += entry.totalHours || 0;
		});

		// Derive each week's status from the ACTUAL entry approval stages (Employee view),
		// so a sheet only the RM has approved reads "Pending approval from HR" instead of a
		// blanket "Approved". APPROVED only results when every entry is fully approved.
		Object.values(weeksMap).forEach(week => {
			const ws = getWeekStatus(week.entries, 'EMPLOYEE');
			week.status = ws.status;
			week.statusLabel = ws.statusLabel;
		});

		return Object.values(weeksMap).sort((a, b) => b.start - a.start).slice(0, 5);
	};

	const fetchTimesheetData = async (id) => {
		if (!id) return;
		try {
			setTimesheetLoading(true);
			const response = await api(`/api/timesheets?employeeId=${id}`);
			if (response.ok) {
				const result = await response.json();
				const data = result.data || [];
				const grouped = groupIntoWeeksSummary(data);
				setRecentTimesheets(grouped);
			}
		} catch (err) {
			console.error("Error fetching timesheet data:", err);
		} finally {
			setTimesheetLoading(false);
		}
	};

	const handleRefreshData = () => {
		if (employeeId) {
			fetchLeaveData(employeeId);
			fetchTimesheetData(employeeId);
		}
	};

	const handleLogout = () => {
		if (window.confirm('Are you sure you want to logout?')) {
			console.log('User logged out');
			localStorage.removeItem("user");
			localStorage.removeItem("token");
			window.location.href = "/login";
		}
	};


	// Aggregate a week's raw entries into per-day rows for the inline detail view.
	const buildDayRows = (entries) => {
		const byDate = {};
		(entries || []).forEach((e) => {
			const key = e.date;
			if (!byDate[key]) byDate[key] = { date: e.date, billable: 0, nonBillable: 0, timeOff: 0, total: 0 };
			const h = e.totalHours || 0;
			byDate[key].total += h;
			if (e.category === 'HOLIDAY' || e.category === 'TIMEOFF' || e.category === 'LEAVE') byDate[key].timeOff += h;
			else if (e.category === 'TRUTIME') byDate[key].billable += h;
			else if (e.billable) byDate[key].billable += h;
			else byDate[key].nonBillable += h;
		});
		return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
	};

	const getStatusColor = (status) => {
		switch (status?.toUpperCase()) {
			case 'APPROVED':
				return 'bg-emerald-500 text-white';
			case 'PENDING':
				return 'bg-yellow-400 text-slate-900';
			case 'REJECTED':
				return 'bg-red-600 text-white';
			default:
				return 'bg-gray-400 text-white';
		}
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB');
	};

	const calculateDuration = (start, end) => {
		if (!start || !end) return "0.0";
		const [startH, startM] = start.split(':').map(Number);
		const [endH, endM] = end.split(':').map(Number);
		const startTotal = startH * 60 + startM;
		const endTotal = endH * 60 + endM;
		let diff = endTotal - startTotal;
		if (diff < 0) diff += 24 * 60;
		return (diff / 60).toFixed(1);
	};

	const formatTime12h = (time24) => {
		if (!time24) return "—";
		const [hours, minutes] = time24.split(':').map(Number);
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const h12 = hours % 12 || 12;
		const m = minutes.toString().padStart(2, '0');
		return `${h12}:${m} ${ampm}`;
	};

	const navItems = [
		{
			tab: "dashboard",
			label: "Dashboard",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3" y="3" width="7" height="7"></rect>
					<rect x="14" y="3" width="7" height="7"></rect>
					<rect x="14" y="14" width="7" height="7"></rect>
					<rect x="3" y="14" width="7" height="7"></rect>
				</svg>
			)
		},
		{
			tab: "timesheet",
			label: "Timesheet",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
			)
		},
		{
			tab: "leave",
			label: "Leave Request",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
					<polyline points="14 2 14 8 20 8"></polyline>
					<line x1="16" y1="13" x2="8" y2="13"></line>
					<line x1="16" y1="17" x2="8" y2="17"></line>
					<polyline points="10 9 9 9 8 9"></polyline>
				</svg>
			)
		}
	];

	// Client Timesheet button: visible ONLY when the employee is assigned AND has verified
	// their activation OTP. Inserted right after Timesheet.
	if (clientAssigned && clientVerified) {
		navItems.splice(2, 0, {
			tab: "client-timesheet",
			label: "Client Timesheet",
			to: "/employee/client-timesheet",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
					<path d="M8 3h8"></path>
				</svg>
			)
		});
	}

	// Add HR Actions if user is HR
	if (user.role === 'HR') {
		navItems.push({
			tab: "actions",
			label: "Actions",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12" y2="16"></line>
				</svg>
			),
			to: "/hr/actions",
		});
	}

	return (
		<div className="flex min-h-screen bg-bg-slate font-brand text-brand-text">
			{/* Mobile Hamburger Button */}
			<button
				onClick={() => setIsMobileMenuOpen(true)}
				className={`md:hidden fixed top-4 left-4 z-50 bg-brand-yellow text-brand-text rounded-lg p-2 shadow-lg transition-all active:scale-95 ${isMobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
			>
				<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>

			{/* Sidebar - Desktop & Mobile Drawer */}
			<div className={`fixed inset-0 z-50 md:relative md:flex md:inset-auto ${isMobileMenuOpen ? 'flex' : 'hidden md:flex'}`}>
				{/* Mobile Overlay */}
				<div
					className="absolute inset-0 bg-brand-blue/60 backdrop-blur-sm md:hidden"
					onClick={() => setIsMobileMenuOpen(false)}
				/>

				<div className={`relative w-64 h-full md:h-auto animate-in slide-in-from-left duration-300 md:animate-none`}>
					{/* Mobile Close Button */}
					<button
						onClick={() => setIsMobileMenuOpen(false)}
						className="md:hidden absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>

					<Sidebar
						activeTab={activeTab}
						setActiveTab={(tab) => {
							setActiveTab(tab);
							setIsMobileMenuOpen(false);
						}}
						handleLogout={handleLogout}
						navItems={navItems}
						hideLogout={true}
					/>
				</div>
			</div>

			{/* Main Content */}
			<main className="flex-1 flex flex-col">
				{/* Conditional Header */}
				{activeTab === 'dashboard' ? (
				<header className="bg-white px-4 md:px-8 py-4 flex flex-wrap items-center justify-between shadow-sm z-40 border-b border-[#E3E8EF]">
					<div className="flex items-center gap-3 sm:gap-6 ml-12 md:ml-0">
						<div>
							<h1 className="text-[16px] font-medium text-brand-text tracking-tight leading-tight line-clamp-1">
								{ribbonTitle}
							</h1>
							<p className="text-[12px] text-brand-text-secondary mt-0.5">
									{ribbonRoleLabel}{ribbonRoleLabel && ribbonName ? " · " : ""}{ribbonName}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3 relative" id="profile-dropdown-container">
							<NotificationComponent />
							<button
								onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
							className="w-11 h-11 rounded-full border-2 border-brand-yellow overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center bg-brand-yellow/20 p-0"
							title="My Profile"
						>
							{user.photoPath ? (
								<img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
							) : (
								<svg className="w-6 h-6 text-brand-yellow/30" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
									</svg>
								)}
							</button>

							{/* Dropdown Menu */}
							{isProfileDropdownOpen && (
								<div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-brand-blue/5 py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
									<div className="px-4 py-3 space-y-3">
										<div>
											<p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.15em]">Employee Name</p>
											<p className="text-sm font-extrabold text-brand-text">{user.fullName || "—"}</p>
										</div>
										<div>
											<p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.15em]">Reporting Manager</p>
											<p className="text-sm font-extrabold text-brand-text">{user.reportingManagerName || "N/A"}{user.reportingManagerActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}</p>
										</div>
										<div>
											<p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.15em]">HR Coordinator</p>
											<p className="text-sm font-extrabold text-brand-text">{user.hrName || "N/A"}{user.hrActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}</p>
										</div>
									</div>
									<div className="h-px bg-brand-blue/5 mx-2 my-1"></div>
									<button
										onClick={() => {
											setActiveTab("profile");
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
						</div>
					</header>
				) : (
					<header className="bg-white px-4 md:px-8 py-4 flex items-center justify-between shadow-sm z-40 border-b border-[#E3E8EF]">
						<div className="flex items-center gap-3 sm:gap-6 ml-12 md:ml-0">
							<div>
								<h1 className="text-[16px] font-medium text-brand-text tracking-tight leading-tight line-clamp-1">
									{ribbonTitle}
								</h1>
								<p className="text-[12px] text-brand-text-secondary mt-0.5">
									{ribbonRoleLabel}{ribbonRoleLabel && ribbonName ? " · " : ""}{ribbonName}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3 relative" id="profile-dropdown-container">
							<NotificationComponent />
							<button
								onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
								className="w-10 h-10 rounded-full border-2 border-[#E3E8EF] overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center bg-[#F1EFE8] text-[#2C2C2A] p-0"
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

							{/* Dropdown Menu */}
							{isProfileDropdownOpen && (
								<div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-brand-blue/5 py-2 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
									<div className="px-4 py-3 space-y-3">
										<div>
											<p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.15em]">Employee Name</p>
											<p className="text-sm font-extrabold text-brand-text">{user.fullName || "—"}</p>
										</div>
										<div>
											<p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.15em]">Reporting Manager</p>
											<p className="text-sm font-extrabold text-brand-text">{user.reportingManagerName || "N/A"}{user.reportingManagerActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}</p>
										</div>
										<div>
											<p className="text-[9px] font-black text-brand-text/40 uppercase tracking-[0.15em]">HR Coordinator</p>
											<p className="text-sm font-extrabold text-brand-text">{user.hrName || "N/A"}{user.hrActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}</p>
										</div>
									</div>
									<div className="h-px bg-brand-blue/5 mx-2 my-1"></div>
									<button
										onClick={() => {
											setActiveTab("profile");
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
						</div>
					</header>
				)}

				{/* Content Area */}
				<div className={`flex-1 ${activeTab === 'profile' ? 'p-2 md:p-6' : 'p-3 md:p-8'} flex flex-col ${activeTab === 'profile' ? 'gap-2' : 'gap-6 md:gap-8'}`}>
					{activeTab === 'dashboard' && (
						<>
							{/* Client Timesheet activation banner — assigned but not yet verified. */}
							{clientAssigned && !clientVerified && (
								<div
									className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
									style={{
										background: "#EFF6FF",
										borderLeft: "4px solid #185FA5",
										borderRadius: "8px",
										padding: "16px 20px",
									}}
								>
									<div className="flex items-start gap-3">
										<span className="text-xl leading-none mt-0.5">🔔</span>
										<div style={{ color: "#1e3a5f" }} className="text-[14px] font-normal leading-relaxed">
											<p className="font-bold">
												You have been assigned to client project{clientProject ? `: ${clientProject}` : ""}
											</p>
											<p>A verification OTP has been sent to your registered email.</p>
											<p>Verify your access to start logging client hours.</p>
										</div>
									</div>
									<button
										onClick={() => setOtpModalOpen(true)}
										className="shrink-0 self-start sm:self-center text-white font-bold text-[13px] tracking-wide transition-all active:scale-[0.98]"
										style={{ background: "#185FA5", borderRadius: "6px", padding: "10px 18px" }}
									>
										VERIFY ACCESS
									</button>
								</div>
							)}

							{error && (
								<div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
									{error}
								</div>

							)}

							{/* Probation Notice */}
							{leaveBalance && leaveBalance.onProbation && (
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

							{/* Stats Grid */}
							<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
								{loading ? (
									<div className="col-span-full text-center text-brand-text/30 py-10 animate-pulse font-bold uppercase tracking-widest text-xs">Loading leave data...</div>
								) : leaveBalance ? (
									[
										{
											label: "Casual & Earned",
											value: (leaveBalance.casualLeavesRemaining || 0).toFixed(0).padStart(2, '0'),
											carry: leaveBalance.casualLeavesCarriedForward,
											color: "text-brand-yellow"
										},
										{
											label: "Sick Leaves",
											value: (leaveBalance.sickLeavesRemaining || 0).toFixed(0).padStart(2, '0'),
											color: "text-red-500"
										},
										{
											label: "Maternity",
											value: (leaveBalance.maternityLeavesRemaining || 0).toFixed(0).padStart(2, '0'),
											color: "text-brand-blue-hover"
										},
										{
											label: "Paternity",
											value: (leaveBalance.paternityLeavesRemaining || 0).toFixed(0).padStart(2, '0'),
											color: "text-brand-blue-dark"
										},
										{
											label: "Bereavement",
											value: (leaveBalance.bereavementLeavesRemaining || 0).toFixed(0).padStart(2, '0'),
											color: "text-brand-yellow-hover"
										},
									].map((stat, index) => (
										<div key={index} className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-brand-blue/5 card-hover flex flex-col items-center">
											<div className="text-brand-text/40 text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-2 text-center">{stat.label}</div>
											<div className={`text-3xl md:text-4xl font-black ${stat.color}`}>{stat.value}</div>
											{stat.carry > 0 && (
												<div className="text-[9px] font-bold text-brand-text/40 mt-1">+{stat.carry.toFixed(1)} carried fwd</div>
											)}
										</div>
									))
								) : (
									<div className="col-span-full text-center text-brand-text/30 py-10 font-bold uppercase tracking-widest text-xs">No leave balance found</div>
								)}
							</div>

							{/* Time Sheet Tabl e */}
							<div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-blue/5 card-hover">
								<div className="px-6 py-4 border-b border-brand-blue/5 bg-brand-blue">
									<h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Time sheet</h2>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse text-sm">
										<thead className="bg-bg-slate">
											<tr className="text-brand-text/40 font-bold uppercase tracking-widest text-[9px]">
												<th className="p-4 px-6 border-b border-brand-blue/5">Week Period</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Status</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-center">Entries</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-right whitespace-nowrap">Total Hours</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-right">Action</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-brand-blue/5">
											{timesheetLoading ? (
												<tr>
													<td colSpan="5" className="p-8 text-center text-brand-text/30 font-bold uppercase tracking-widest text-[10px]">Loading weekly history...</td>
												</tr>
											) : recentTimesheets.length > 0 ? (
												recentTimesheets.map((week) => (
													<React.Fragment key={week.weekKey}><tr className="hover:bg-bg-slate transition-colors font-medium">
														<td className="p-4 px-6">
															<div className="flex flex-col">
																<span className="font-bold text-brand-text uppercase text-xs">Week of {week.startDateStr}</span>
																<span className="text-[10px] text-brand-text/40 font-bold">{week.startDateStr} — {week.endDateStr}</span>
															</div>
														</td>
														<td className="p-4 px-6">
															<span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${week.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : week.status === 'REJECTED' ? 'bg-red-100 text-red-600' : week.status === 'PENDING_HR_APPROVAL' ? 'bg-blue-100 text-blue-600' : week.status === 'NOT_FILLED' ? 'bg-slate-100 text-slate-500' : 'bg-brand-yellow/10 text-brand-yellow'}`}>
																{week.statusLabel || week.status}
															</span>
														</td>
														<td className="p-4 px-6 text-center text-brand-text/60">{week.entries.length} Days</td>
														<td className="p-4 px-6 text-right font-black text-brand-text">{week.totalHours.toFixed(1)}</td>
														<td className="p-4 px-6 text-right">
															<button
																onClick={() => setExpandedWeek((w) => (w === week.weekKey ? null : week.weekKey))}
																className="bg-[#185FA5] hover:bg-[#13507f] text-white text-[12px] font-medium rounded-md px-[14px] py-[5px] transition-colors"
															>
																View Details
															</button>
														</td>
													</tr>
													{expandedWeek === week.weekKey && (
														<tr>
															<td colSpan={5} className="p-0 bg-bg-slate border-b border-brand-blue/5">
																<div className="px-6 py-4">
																	<div className="flex items-center justify-between mb-3">
																		<span className="text-xs font-bold text-brand-text">Week of {week.startDateStr} ({week.startDateStr} — {week.endDateStr})</span>
																		<span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${week.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : week.status === 'REJECTED' ? 'bg-red-100 text-red-600' : week.status === 'PENDING_HR_APPROVAL' ? 'bg-blue-100 text-blue-600' : week.status === 'NOT_FILLED' ? 'bg-slate-100 text-slate-500' : 'bg-brand-yellow/10 text-brand-yellow'}`}>{week.statusLabel || week.status}</span>
																	</div>
																	{week.entries.length > 0 ? (
																		<div className="overflow-x-auto rounded-lg border border-brand-blue/5 bg-white">
																			<table className="w-full text-left text-xs">
																				<thead className="bg-bg-slate text-brand-text/40 uppercase tracking-widest text-[9px] font-bold">
																					<tr>
																						<th className="p-2 px-4">Date</th>
																						<th className="p-2 px-4 text-right">Billable Project</th>
																						<th className="p-2 px-4 text-right">Non-Billable</th>
																						<th className="p-2 px-4 text-right">Time Off/Holiday</th>
																						<th className="p-2 px-4 text-right">Total</th>
																					</tr>
																				</thead>
																				<tbody className="divide-y divide-brand-blue/5">
																					{buildDayRows(week.entries).map((d) => (
																						<tr key={d.date}>
																							<td className="p-2 px-4 font-bold text-brand-text">{formatDate(d.date)}</td>
																							<td className="p-2 px-4 text-right text-brand-text/70">{d.billable.toFixed(1)}</td>
																							<td className="p-2 px-4 text-right text-brand-text/70">{d.nonBillable.toFixed(1)}</td>
																							<td className="p-2 px-4 text-right text-brand-text/70">{d.timeOff.toFixed(1)}</td>
																							<td className="p-2 px-4 text-right font-black text-brand-text">{d.total.toFixed(1)}</td>
																						</tr>
																					))}
																				</tbody>
																				<tfoot>
																					<tr className="bg-bg-slate font-black text-brand-text">
																						<td className="p-2 px-4 uppercase text-[9px] tracking-widest">Total</td>
																						<td className="p-2 px-4"></td>
																						<td className="p-2 px-4"></td>
																						<td className="p-2 px-4"></td>
																						<td className="p-2 px-4 text-right">{week.totalHours.toFixed(1)}</td>
																					</tr>
																				</tfoot>
																			</table>
																		</div>
																	) : (
																		<p className="text-[10px] text-brand-text/30 font-bold uppercase tracking-widest">No entries for this week</p>
																	)}
																</div>
															</td>
														</tr>
													)}
												</React.Fragment>
												))
											) : (
												<tr>
													<td colSpan="5" className="p-8 text-center text-brand-text/20 font-bold uppercase tracking-widest text-[10px]">No recent timesheets found</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>

							{/* Recent Leave History Tabl e */}
							<div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-blue/5 card-hover">
								<div className="px-6 py-4 border-b border-brand-blue/5 bg-brand-blue">
									<h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Recent Leave History</h2>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full text-left border-collapse text-sm">
										<thead className="bg-bg-slate">
											<tr className="text-brand-text/40 font-bold uppercase tracking-widest text-[9px]">
												<th className="p-4 px-6 border-b border-brand-blue/5">Type</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Reason</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Dates</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Status</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Approved By</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-right">Actions</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-brand-blue/5">
											{loading ? (
												<tr>
													<td colSpan="6" className="p-8 text-center text-brand-text/30 font-bold uppercase tracking-widest text-[10px]">Loading leave history...</td>
												</tr>
											) : recentLeaves.length > 0 ? (
												recentLeaves.map((leave) => (
													<tr key={leave.id} className="hover:bg-bg-slate transition-colors font-medium">
														<td className="p-4 px-6 font-bold text-brand-text uppercase text-xs">{leave.leaveType}</td>
														<td className="p-4 px-6 text-brand-text/60 text-xs italic truncate max-w-[150px]">{leave.reason || "-"}</td>
														<td className="p-4 px-6 text-brand-text/70">
															{formatDate(leave.startDate)} → {formatDate(leave.endDate)}
														</td>
														<td className="p-4 px-6">
															<span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${getStatusColor(leave.status)}`}>
																{leave.status}
															</span>
														</td>
														<td className="p-4 px-6">
															{leave.approvedBy ? (
																<div className="space-y-0.5">
																	<p className="font-bold text-brand-text text-xs uppercase">{getLeaveActionLabel(leave)}</p>
																	{leave.reviewedAt && (
																		<p className="text-[10px] text-brand-text/40 font-bold">{formatDate(leave.reviewedAt)}</p>
																	)}
																</div>
															) : (
																<span className="text-brand-text/30 text-xs italic">Pending review</span>
															)}
														</td>
														<td className="p-4 px-6 text-right">
															<div className="flex justify-end gap-2">
																<button
																	onClick={() => {
																		setSelectedLeave(leave);
																		setIsDetailsModalOpen(true);
																	}}
																	className="p-2 bg-brand-blue/5 text-brand-text rounded-lg hover:bg-brand-blue-dark hover:text-white transition-all shadow-sm"
																	title="View Details"
																>
																	<Eye size={16} />
																</button>															</div>
														</td>
													</tr>
												))
											) : (
												<tr>
													<td colSpan="5" className="p-8 text-center text-brand-text/30 font-bold uppercase tracking-widest text-[10px]">No leave history found</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>
						</>
					)}


					{activeTab === 'timesheet' && (
						<PersonalTimesheetContent employeeId={employeeId} user={user} />

					)}


					{activeTab === 'leave' && (
						<LeaveRequestPage
							employeeId={employeeId}
							leaveBalance={leaveBalance}
							onLeaveRequestSuccess={handleRefreshData}
						/>

					)}


					{activeTab === 'profile' && (
						<EmployeeOwnProfile hideSidebar={true} />

					)}


				</div>
			</main>
			<LeaveDetailsModal
				isOpen={isDetailsModalOpen}
				onClose={() => setIsDetailsModalOpen(false)}
				leave={selectedLeave}
			/>
			<ClientOtpVerifyModal
				isOpen={otpModalOpen}
				onClose={() => setOtpModalOpen(false)}
				projectName={clientProject}
				onVerified={refreshClientAccess}
			/>
		</div>
	);
};

export default EmployeeDashboard;




