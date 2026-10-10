import React from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { UserRole } from "../../lib/api/auth";

export interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600 max-w-md mb-6">
          You do not have the required permissions to access this page. This section requires{" "}
          <span className="font-semibold text-slate-800">
            {allowedRoles.join(" or ")}
          </span>{" "}
          privileges, but your account is registered as{" "}
          <span className="font-semibold text-slate-800 uppercase">{user.role}</span>.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
