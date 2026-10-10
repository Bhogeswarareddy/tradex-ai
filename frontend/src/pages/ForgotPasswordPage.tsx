import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../lib/api/auth";
import { Hexagon, Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
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
          Reset your password
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Enter your registered email and we&apos;ll send you instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Check your inbox</h3>
              <p className="text-xs text-slate-600 mb-6">
                If an account exists for <strong className="font-semibold">{email}</strong>, a reset token has been dispatched. Check console stubs in development mode.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#2563EB] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to sign in</span>
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Registered Work Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                icon={<Mail className="w-4 h-4" />}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={loading}
              >
                Send Password Reset Instructions
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to login</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
