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
} from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { NotificationBellDropdown } from "../../features/communication";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Mobile hamburger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none"
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
            className="w-full pl-10 pr-14 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded shadow-xs">
              ⌘K
            </kbd>
          </div>
        </form>
      </div>

      {/* Right: Actions, Language, Currency, Notifications, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Language selector stub */}
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span>EN</span>
        </div>

        {/* Currency selector stub */}
        <div className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
          <span>USD</span>
        </div>

        {/* Messages icon with count */}
        <Link
          to="/messages"
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
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
        <div className="h-6 w-px bg-slate-200 mx-1" />

        {/* User profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none"
            aria-expanded={profileOpen}
            aria-label="User profile options"
          >
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 capitalize">{displayRole}</span>
            </div>
            <Avatar name={displayName} size="sm" status="online" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 leading-tight">{displayName}</p>
                <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="blue" size="sm">
                    {displayRole.toUpperCase()}
                  </Badge>
                  <span className="text-[11px] text-slate-500 font-medium truncate">
                    {displayCompany}
                  </span>
                </div>
              </div>

              <div className="py-1 text-xs text-slate-700">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Your Profile</span>
                </Link>
                <Link
                  to="/company"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Building className="w-4 h-4 text-slate-400" />
                  <span>Company Account</span>
                </Link>
                <Link
                  to="/design-system"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-blue-50 text-[#2563EB] font-medium transition-colors"
                >
                  <Palette className="w-4 h-4 text-[#2563EB]" />
                  <span>Design System</span>
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Settings</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
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
