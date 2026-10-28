import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  MessageSquare,
  Globe,
  DollarSign,
  Menu,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Palette,
  Building,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { NotificationBellDropdown } from "../../features/communication";
import {
  useSettings,
  SupportedCurrency,
  SupportedLanguage,
} from "../../features/settings/SettingsContext";

export interface TopBarProps {
  onToggleSidebar: () => void;
  currentUser?: {
    id?: string;
    email?: string;
    fullName?: string;
    role?: "buyer" | "supplier" | "admin";
    companyName?: string;
  } | null;
  onLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  currentUser,
  onLogout,
}) => {
  const { currency, language, theme, setCurrency, setLanguage, setTheme } = useSettings();

  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [currOpen, setCurrOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const currRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(target)) {
        setLangOpen(false);
      }
      if (currRef.current && !currRef.current.contains(target)) {
        setCurrOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
        setLangOpen(false);
        setCurrOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const displayName = currentUser?.fullName || "Bhogeswara Reddy";
  const displayEmail = currentUser?.email || "bhogeswara@tradex.ai";
  const displayRole = currentUser?.role || "buyer";
  const displayCompany = currentUser?.companyName || "Global Traders Corp";

  const languages: { code: SupportedLanguage; label: string; full: string }[] = [
    { code: "EN", label: "EN", full: "English" },
    { code: "DE", label: "DE", full: "Deutsch" },
    { code: "HI", label: "HI", full: "हिन्दी" },
  ];

  const currencies: { code: SupportedCurrency; symbol: string; label: string }[] = [
    { code: "USD", symbol: "$", label: "USD ($)" },
    { code: "EUR", symbol: "€", label: "EUR (€)" },
    { code: "INR", symbol: "₹", label: "INR (₹)" },
    { code: "GBP", symbol: "£", label: "GBP (£)" },
    { code: "AED", symbol: "AED", label: "AED" },
    { code: "CNY", symbol: "¥", label: "CNY (¥)" },
  ];

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between gap-4 transition-colors">
      {/* Left: Mobile hamburger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Input with keyboard shortcut */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search products, suppliers, HS codes, RFQs..."
            className="w-full pl-10 pr-14 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-xs">
              ⌘K
            </kbd>
          </div>
        </form>
      </div>

      {/* Right: Actions, Language, Currency, Theme, Notifications, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* AI Mode quick launcher pill */}
        <Link
          to="/ai-mode"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs hover:from-orange-600 hover:to-amber-600 transition-all mr-1"
          title="Open AI Mode"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Mode</span>
        </Link>

        {/* Quick Theme Toggle Icon */}
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Language selector dropdown */}
        <div className="relative" ref={langRef}>
          <button
            type="button"
            onClick={() => {
              setLangOpen(!langOpen);
              setCurrOpen(false);
              setProfileOpen(false);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Change System Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{language}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {langOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              {languages.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLanguage(l.code);
                    setLangOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                    language === l.code
                      ? "text-[#2563EB] font-bold bg-blue-50/50 dark:bg-blue-900/30"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span>{l.full}</span>
                  <span className="text-[10px] text-slate-400">({l.code})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Currency selector dropdown */}
        <div className="relative" ref={currRef}>
          <button
            type="button"
            onClick={() => {
              setCurrOpen(!currOpen);
              setLangOpen(false);
              setProfileOpen(false);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            title="Change Display Currency"
          >
            <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            <span>{currency}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {currOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                Display Currency
              </div>
              {currencies.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setCurrency(c.code);
                    setCurrOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                    currency === c.code
                      ? "text-[#2563EB] font-bold bg-blue-50/50 dark:bg-blue-900/30"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span>{c.label}</span>
                  {currency === c.code && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages icon with count */}
        <Link
          to="/messages"
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Messages"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            3
          </span>
        </Link>

        {/* Notification bell dropdown with unread count & popover */}
        <NotificationBellDropdown />

        {/* Vertical divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* User profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setLangOpen(false);
              setCurrOpen(false);
            }}
            className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none"
            aria-expanded={profileOpen}
            aria-label="User profile options"
          >
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 capitalize">{displayRole}</span>
            </div>
            <Avatar name={displayName} size="sm" status="online" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {displayEmail}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="blue" size="sm">
                    {displayRole.toUpperCase()}
                  </Badge>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    {displayCompany}
                  </span>
                </div>
              </div>

              <div className="py-1 text-xs text-slate-700 dark:text-slate-300">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Your Profile</span>
                </Link>
                <Link
                  to="/company"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>Company Account</span>
                </Link>
                <Link
                  to="/design-system"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[#2563EB] font-medium transition-colors"
                >
                  <Palette className="w-4 h-4 text-[#2563EB]" />
                  <span>Design System</span>
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Settings</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
