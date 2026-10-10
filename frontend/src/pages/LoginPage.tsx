import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { Hexagon, Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Hexagon Logo Header */}
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
          Sign in to your account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Or{" "}
          <Link
            to="/register"
            className="font-semibold text-[#2563EB] hover:text-blue-700 hover:underline"
          >
            create a new TradeX account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Work Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              icon={<Mail className="w-4 h-4" />}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#2563EB] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                icon={<Lock className="w-4 h-4" />}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={loading}
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          {/* Demo Accounts Quick-Fill Section */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
              Quick Demo Logins
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount("bhogeswara@tradex.ai", "buyer123")}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-[11px] font-semibold text-slate-700 transition-colors text-center"
              >
                Buyer
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("supplier@sribharat.com", "supplier123")}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-[11px] font-semibold text-slate-700 transition-colors text-center"
              >
                Supplier
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("admin@tradex.ai", "admin123")}
                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-[11px] font-semibold text-slate-700 transition-colors text-center"
              >
                Admin
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Pre-configured demo credentials from platform seed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
