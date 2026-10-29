import React, { useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { authApi } from "../lib/api/auth";
import {
  User,
  Building,
  Globe,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { success, error: toastError } = useToast();

  // Profile Edit State
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [companyName, setCompanyName] = useState(user?.company_name || "");
  const [country, setCountry] = useState(user?.company_country || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // Sync state when user updates
  React.useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setCompanyName(user.company_name || "");
      setCountry(user.company_country || "");
    }
  }, [user]);

  // Password Change State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await authApi.updateMe({
        full_name: fullName,
        company_name: companyName,
        country: country,
      });
      await refreshUser();
      success("Profile Updated", "Your profile details have been saved.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      toastError("Update Failed", msg);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 10 || !/\d/.test(newPassword)) {
      setPasswordError("New password must be at least 10 characters long and contain at least one number.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      success("Password Changed", "Your password has been successfully updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setPasswordError(msg);
      toastError("Password Error", msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0A1230] to-[#2563EB] text-white flex items-center justify-center font-bold text-2xl shadow-md">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{user?.full_name || "User Profile"}</h1>
              <Badge variant="blue" size="sm">
                {(user?.role || "BUYER").toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              {user?.company_name || "Independent"} • {user?.company_country || "Global"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(() => {
            const status = (user?.verified_status || "unverified").toLowerCase();
            if (status === "verified") {
              return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Company Verified</span>
                </span>
              );
            }
            if (status === "rejected") {
              return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Verification Rejected</span>
                </span>
              );
            }
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span>Verification Pending</span>
              </span>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Information Card */}
        <Card
          title="Account Details"
          description="Update your personal details and company information"
          className="shadow-sm"
        >
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <Input
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              icon={<User className="w-4 h-4" />}
              required
            />
            <Input
              label="Email Address"
              value={user?.email || ""}
              disabled
              helper="Email address cannot be modified directly"
              icon={<Mail className="w-4 h-4" />}
            />
            <Input
              label="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              icon={<Building className="w-4 h-4" />}
            />
            <Input
              label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              icon={<Globe className="w-4 h-4" />}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={profileSaving}
              className="w-full mt-2"
            >
              Save Profile Changes
            </Button>
          </form>
        </Card>

        {/* Change Password Card */}
        <Card
          title="Security & Password"
          description="Ensure your account uses a strong 10+ character password"
          className="shadow-sm"
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            {passwordError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}
            <Input
              label="Current Password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              icon={<KeyRound className="w-4 h-4" />}
              required
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              helper="Min 10 characters with at least one number"
              icon={<Lock className="w-4 h-4" />}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              required
            />
            <Button
              type="submit"
              variant="outline"
              size="md"
              isLoading={passwordSaving}
              className="w-full mt-2"
            >
              Update Password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
