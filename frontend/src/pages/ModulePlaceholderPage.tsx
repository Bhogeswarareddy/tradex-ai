import React from "react";
import { EmptyState } from "../components/EmptyState";
import { SimulatedBadge } from "../components/SimulatedBadge";

interface ModulePlaceholderPageProps {
  title: string;
  description: string;
  simulated?: boolean;
}

export const ModulePlaceholderPage: React.FC<ModulePlaceholderPageProps> = ({
  title,
  description,
  simulated = false,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        {simulated && <SimulatedBadge />}
      </div>

      <EmptyState
        title={`${title} Module`}
        description="Foundation initialized. This module's full functionality will be implemented in subsequent roadmap prompts."
        actionLabel="Back to Marketplace"
        onAction={() => window.location.assign("/")}
      />
    </div>
  );
};
