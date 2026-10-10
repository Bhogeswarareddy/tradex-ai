import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import {
  Hexagon,
  Lock,
  Mail,
  User,
  Building,
  Globe,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Factory,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [country, setCountry] = useState("India");
  const [role, setRole] = useState<"buyer" | "supplier">("buyer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  // Password requirements validation
  const hasMinLength = password.length >= 10;
  const hasDigit = /\d/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasMinLength || !hasDigit) {
      setError("Password must be at least 10 characters long and contain at least one number.");
      return;
    }

    setLoading(true);

    try {
      await register({
        email,
        password,
        full_name: fullName,
        company_name: companyName,
        country,
        role,
      });
      navigate("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed. Please check your information and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Logo */}
        <div className="flex justify-center items-center gap-3">
          <div className="relative flex items-center justify-center text-[#2563EB]">
            <Hexagon className="w-11 h-11 fill-[#2563EB] text-blue-400/30" />
            <span className="absolute inset-0 flex items-center justify-center font-black text-white text-lg">
              X
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">TradeX AI</h1>
            <p className="text-xs text-slate-500 font-medium">B2B Trade Discovery</p>
          </div>
        </div>

        <h2 className="mt-6 text-center text-xl font-bold text-slate-900">
          Create your TradeX account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#2563EB] hover:text-blue-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Role Selector Toggle */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              I want to join TradeX as:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("buyer")}
                className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                  role === "buyer"
                    ? "border-[#2563EB] bg-blue-50/50 text-[#2563EB] ring-2 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <ShoppingBag className="w-5 h-5 mb-1 text-[#2563EB]" />
                <span className="text-xs font-bold">Buyer / Importer</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Source & Request Quotes</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("supplier")}
                className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all ${
                  role === "supplier"
                    ? "border-[#2563EB] bg-blue-50/50 text-[#2563EB] ring-2 ring-blue-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <Factory className="w-5 h-5 mb-1 text-[#2563EB]" />
                <span className="text-xs font-bold">Supplier / Exporter</span>
                <span className="text-[10px] text-slate-400 mt-0.5">List Catalog & Bid RFQs</span>
              </button>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Bhogeswara Reddy"
                icon={<User className="w-4 h-4" />}
              />
              <Input
                label="Work Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                icon={<Mail className="w-4 h-4" />}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Company Name"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Global Exim Ltd"
                icon={<Building className="w-4 h-4" />}
              />
              <Input
                label="Country of Operation"
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                icon={<Globe className="w-4 h-4" />}
              />
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 10 characters with numbers"
                icon={<Lock className="w-4 h-4" />}
              />
              {/* Password strength checklist */}
              <div className="mt-2 flex items-center gap-4 text-[11px]">
                <div
                  className={`flex items-center gap-1 ${
                    hasMinLength ? "text-emerald-600 font-medium" : "text-slate-400"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>10+ characters</span>
                </div>
                <div
                  className={`flex items-center gap-1 ${
                    hasDigit ? "text-emerald-600 font-medium" : "text-slate-400"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>At least 1 number</span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-4"
              isLoading={loading}
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
