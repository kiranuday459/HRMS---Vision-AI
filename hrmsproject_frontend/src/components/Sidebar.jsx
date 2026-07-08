
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Logo from '../assets/visionai-logo.png';
import useSidebarCollapsed from '../hooks/useSidebarCollapsed';


const Sidebar = ({ activeTab, setActiveTab, handleLogout, navItems, hideLogout = false }) => {
	const navigate = useNavigate();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [collapsed, toggleCollapsed] = useSidebarCollapsed();

	const closeMobile = () => setMobileOpen(false);
	const NavButton = ({ tab, label, icon, onClick, to }) => (
		<button
			type="button"
			title={collapsed ? label : undefined}
			aria-label={label}
			onClick={e => {
				e.stopPropagation();
				if (to) {
					navigate(to);
				} else if (onClick) {
					onClick();
				} else {
					setActiveTab(tab);
				}
			}}
			className={`btn-sidebar w-full flex items-center mb-1 ${collapsed ? 'justify-center px-0!' : 'gap-3'} ${activeTab === tab
				? 'bg-[#F1EFE8] text-[#2C2C2A] border-l-[3px] border-brand-stone rounded-lg px-5 py-3'
				: 'text-[#5F5E5A] hover:text-[#2C2C2A] hover:bg-[#F1EFE8] transition-colors'
				}`}
		>
			<span className={`flex items-center justify-center transition-transform ${collapsed ? 'scale-125' : ''}`}>{icon}</span>
			{!collapsed && <span className="font-semibold whitespace-nowrap">{label}</span>}
		</button>
	);

	return (
		<>
			{/* Hamburger for mobile/tablet */}
			<button
				className="fixed top-4 left-4 z-50 block lg:hidden bg-white p-2 rounded-lg shadow-md border border-[#E3E8EF] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
				onClick={() => setMobileOpen(true)}
				title="Open menu"
			>
				<svg className="w-6 h-6 text-[#5F5E5A]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
					<path d="M3 12h18M3 6h18M3 18h18" />
				</svg>
			</button>

			{/* Mobile drawer overlay */}
			{mobileOpen && (
				<div className="fixed inset-0 z-50 flex">
					<div className="fixed inset-0 bg-black/50" onClick={closeMobile} />
					<aside className="w-64 bg-white text-[#2C2C2A] border-r border-[#E3E8EF] flex flex-col h-full shadow-xl overflow-hidden animate-in slide-in-from-left duration-200">
						<div className="p-4 border-b border-[#E3E8EF] flex flex-col items-center">
							<img src={Logo} alt="VisionAi Logo" className="h-12 mb-2 object-contain" />
						</div>
						<nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-hide">
							{navItems.map((item, index) => {
								if (item.type === 'heading') {
									return (
										<div key={`heading-m-${index}`} className="px-4 pt-4 pb-2 text-[10px] font-black text-[#888780] uppercase tracking-[0.2em]">
											{item.label}
										</div>
									);
								}
								const isActive = activeTab === item.tab;
								return (
									<button key={item.tab || index} onClick={() => { closeMobile(); if (item.to) navigate(item.to); else setActiveTab(item.tab); }} className={`w-full flex items-center gap-3 mb-1 transition-all duration-200 py-3 px-4 rounded-lg ${isActive ? 'bg-[#F1EFE8] text-[#2C2C2A] border-l-[3px] border-brand-stone' : 'text-[#5F5E5A] hover:text-[#2C2C2A] hover:bg-[#F1EFE8]'}`}>
										{item.icon}
										<span className="font-semibold">{item.label}</span>
									</button>
								);
							})}
						</nav>
					</aside>
				</div>
			)}

			{/* Desktop full sidebar (visible on lg) */}
			<aside className={`hidden lg:flex ${collapsed ? 'w-20' : 'w-64'} bg-white text-[#2C2C2A] border-r border-[#E3E8EF] flex-col h-screen sticky top-0 overflow-hidden transition-[width] duration-300 ease-in-out`}>

			{/* Logo + Collapse Toggle */}
			<div className={`p-4 border-b border-[#E3E8EF] flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
				{!collapsed && <img src={Logo} alt="VisionAi Logo" className="h-12 object-contain" />}
				<button
					type="button"
					onClick={toggleCollapsed}
					title={collapsed ? 'Show Sidebar' : 'Hide Sidebar'}
					aria-label={collapsed ? 'Show Sidebar' : 'Hide Sidebar'}
					aria-expanded={!collapsed}
					className="shrink-0 w-9 h-9 rounded-lg bg-[#F1EFE8] text-[#5F5E5A] flex items-center justify-center hover:bg-[#E3E8EF] hover:text-[#2C2C2A] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-stone"
				>
					{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
				</button>
			</div>

			{/* Navigation */}
			<nav className={`flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-hide ${collapsed ? 'px-2' : 'px-4'}`}>
				{navItems.map((item, index) => {
					if (item.type === 'heading') {
						if (collapsed) {
							return <div key={`heading-${index}`} className="my-3 mx-2 border-t border-[#E3E8EF]" />;
						}
						return (
							<div key={`heading-${index}`} className="px-4 pt-4 pb-2 text-[10px] font-black text-[#888780] uppercase tracking-[0.2em]">
								{item.label}
							</div>
						);
					}
					return (
						<NavButton
							key={item.tab || index}
							tab={item.tab}
							label={item.label}
							icon={item.icon}
							onClick={item.onClick}
							to={item.to}
						/>
					);
				})}
			</nav>

			{/* Logout Button */}
			{!hideLogout && (
				<div className={`border-t border-[#E3E8EF] ${collapsed ? 'p-2' : 'p-4'}`}>
					<button
						onClick={handleLogout}
						title={collapsed ? 'Logout' : undefined}
						aria-label="Logout"
						className={`w-full flex items-center justify-center gap-2 py-3 bg-white border border-[#E3E8EF] text-[#5F5E5A] rounded-lg text-sm font-bold hover:bg-brand-yellow hover:border-brand-yellow hover:text-white transition-all duration-200 active:scale-[0.98] ${collapsed ? 'px-0' : ''}`}
					>
						<svg
							className={`shrink-0 ${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
							<polyline points="16 17 21 12 16 7"></polyline>
							<line x1="21" y1="12" x2="9" y2="12"></line>
						</svg>
						{!collapsed && <span>LOGOUT</span>}
					</button>
				</div>
			)}
			</aside>

			{/* Compact sidebar for md (icon-only) */}
			<aside className="hidden md:flex lg:hidden w-20 bg-white text-[#2C2C2A] border-r border-[#E3E8EF] flex-col h-screen sticky top-0 overflow-hidden items-center py-4">
				<img src={Logo} alt="Logo" className="h-8 mb-4 object-contain" />
				<nav className="flex-1 flex flex-col items-center gap-2 overflow-y-auto">
					{navItems.map((item, index) => {
						if (item.type === 'heading') return null;
						return (
							<button key={item.tab || index} type="button" onClick={e => { e.stopPropagation(); if (item.to) { navigate(item.to); } else { setActiveTab(item.tab); } }} className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200 ${activeTab === item.tab ? 'bg-[#F1EFE8] text-[#2C2C2A] border-l-[3px] border-brand-stone' : 'text-[#5F5E5A] hover:text-[#2C2C2A] hover:bg-[#F1EFE8] hover:-translate-y-0.5'}`}>
								{item.icon}
							</button>
						);
					})}
				</nav>
				{!hideLogout && (
					<button onClick={handleLogout} className="w-12 h-12 mb-4 flex items-center justify-center rounded-lg bg-[#F1EFE8] text-[#5F5E5A] hover:bg-brand-yellow hover:text-white">
						<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
					</button>
				)}
			</aside>
		</>
	);
};

export default Sidebar;
