import React, { useState, useEffect } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { authApi, CompanyAccount } from "../lib/api/auth";
import {
  Globe,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Shield,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { Link } from "react-router-dom";

export const CompanyPage: React.FC = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState<CompanyAccount | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await authApi.getCompany();
        setCompany(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load company details";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, []);

  const getVerificationBadge = (status?: string) => {
    const s = (status || "unverified").toLowerCase();
    if (s === "verified") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Verified Business</span>
        </span>
      );
    }
    if (s === "rejected") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>Verification Rejected</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <Shield className="w-4 h-4 text-amber-500" />
        <span>Verification Pending</span>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton variant="rectangular" height={160} className="w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton variant="rectangular" height={180} className="w-full rounded-2xl" />
          <Skeleton variant="rectangular" height={180} className="w-full rounded-2xl col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <EmptyState
        title="Company Information Not Found"
        description={error || "Could not retrieve your enterprise company record."}
        actionLabel="Go to Profile"
        onAction={() => window.location.assign("/profile")}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Enterprise Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0A1230] to-[#2563EB] text-white flex items-center justify-center font-bold text-3xl shadow-lg border border-slate-100">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
              <Badge variant="blue" size="sm">
                {(user?.role || "BUYER").toUpperCase()} ENTITY
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{company.city}, {company.country}</span>
              {company.website && (
                <>
                  <span className="text-slate-300">•</span>
                  <a
                    href={company.website.startsWith("http") ? company.website : "https://" + company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2563EB] hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{company.website}</span>
                  </a>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          {getVerificationBadge(company.verified_status)}
          <span className="text-xs text-slate-400">
            Registered: {company.years_in_business} {company.years_in_business === 1 ? "year" : "years"} in business
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="space-y-6 lg:col-span-1">
          <Card title="Corporate Details" className="shadow-sm">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Legal Entity</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{company.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Country of Origin</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{company.country}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operational Hub</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{company.city}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Track Record</dt>
                <dd className="font-medium text-slate-800 mt-0.5">{company.years_in_business} Years Active</dd>
              </div>
            </dl>
          </Card>

          <Card title="Account Representative" className="shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                {user?.full_name?.charAt(0) || "U"}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link to="/profile">
                <Button variant="outline" size="sm" className="w-full">
                  Edit Personal Profile
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Column: Verification & Description */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Company Overview" className="shadow-sm">
            <p className="text-sm text-slate-600 leading-relaxed">
              {company.description ||
                company.name + " is a cross-border trading organization registered in " + company.country + ", operating out of " + company.city + " with " + company.years_in_business + " years of international trade operations."}
            </p>
          </Card>

          <Card
            title="Compliance & Verification Status"
            description="Official corporate validation documents submitted to TradeX AI"
            className="shadow-sm"
          >
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200">
                  <FileText className="w-6 h-6 text-[#2563EB]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Certificate of Incorporation & Trade License</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Verified through automated TradeX Document Intelligence OCR verification pipeline.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {getVerificationBadge(company.verified_status)}
                    <span className="text-xs text-slate-400">KYC Status ID: {company.id?.slice(0, 8) || "TX-9902"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">Need to update official business compliance papers?</span>
              <Link to="/documents">
                <Button variant="outline" size="sm" className="gap-2">
                  <span>Manage Documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
