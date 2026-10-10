import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  aiSearchApi,
  AiSearchResponse,
  AiSearchHistoryItem,
  ExtractedRequirement,
} from "../lib/api/aiSearch";
import {
  AiSearchHero,
  StreamingProgressLine,
  UnderstoodRequirementCard,
  FilterRelaxationSuggestions,
  AiSearchResultsTabs,
  SearchHistoryDrawer,
  ScoreBreakdownDrawer,
} from "../features/ai-search";
import { ErrorState } from "../components/ErrorState";

export const AiSearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryParam = searchParams.get("q") || "";

  const [currentQuery, setCurrentQuery] = useState(queryParam);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchResponse, setSearchResponse] = useState<AiSearchResponse | null>(null);
  const [editedRequirement, setEditedRequirement] = useState<ExtractedRequirement | null>(null);

  const [activeTab, setActiveTab] = useState<"suppliers" | "products">("suppliers");
  const [isSaved, setIsSaved] = useState(false);
  const [breakdownSupplier, setBreakdownSupplier] = useState<any | null>(null);

  // History state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<AiSearchHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Fetch search history
  const loadHistory = useCallback(async () => {
    try {
      setIsHistoryLoading(true);
      const items = await aiSearchApi.getHistory();
      setHistoryItems(items);
    } catch {
      // Non-critical, ignore if user is unauthenticated
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Execute Search
  const executeSearch = useCallback(
    async (queryText: string) => {
      if (!queryText.trim()) return;

      setIsLoading(true);
      setError(null);
      setIsSaved(false);

      // Update URL query string
      setSearchParams({ q: queryText });

      try {
        const response = await aiSearchApi.search(queryText);
        setSearchResponse(response);
        setEditedRequirement(response.requirement);
        loadHistory();
      } catch (err: any) {
        setError(err.message || "Failed to parse search query. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [setSearchParams, loadHistory]
  );

  // Auto-search if q is present in URL on initial mount
  useEffect(() => {
    if (queryParam && (!searchResponse || searchResponse.query !== queryParam)) {
      setCurrentQuery(queryParam);
      executeSearch(queryParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam]);

  // Client-side filtering when editedRequirement is changed without re-calling AI
  const filteredSuppliers = useMemo(() => {
    if (!searchResponse) return [];
    if (!editedRequirement) return searchResponse.suppliers;

    return searchResponse.suppliers.filter((s) => {
      // If user modified origin country, match supplier country
      if (
        editedRequirement.origin_country &&
        !s.country.toLowerCase().includes(editedRequirement.origin_country.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [searchResponse, editedRequirement]);

  const filteredProducts = useMemo(() => {
    if (!searchResponse) return [];
    if (!editedRequirement) return searchResponse.products;

    return searchResponse.products.filter((p) => {
      // Match product name or category
      if (editedRequirement.product) {
        const needle = editedRequirement.product.toLowerCase();
        const inName = p.name.toLowerCase().includes(needle);
        const inCat = p.category_name.toLowerCase().includes(needle);
        if (!inName && !inCat) return false;
      }

      // Match origin country
      if (
        editedRequirement.origin_country &&
        !p.origin_country.toLowerCase().includes(editedRequirement.origin_country.toLowerCase())
      ) {
        return false;
      }

      // Match delivery days
      if (
        editedRequirement.delivery_days !== undefined &&
        p.lead_time_days > editedRequirement.delivery_days
      ) {
        return false;
      }

      return true;
    });
  }, [searchResponse, editedRequirement]);

  // Handle client-side requirement modification
  const handleRequirementChange = (updated: ExtractedRequirement) => {
    setEditedRequirement(updated);
  };

  // Handle relaxation suggestion apply
  const handleApplyRelaxation = (suggestion: string) => {
    if (!editedRequirement) return;
    const lower = suggestion.toLowerCase();
    const updated = { ...editedRequirement };

    if (lower.includes("origin") || lower.includes("country")) {
      updated.origin_country = undefined;
    }
    if (lower.includes("lead time") || lower.includes("delivery") || lower.includes("days")) {
      updated.delivery_days = undefined;
    }
    if (lower.includes("cert") || lower.includes("organic")) {
      updated.certifications = [];
    }
    if (lower.includes("moq") || lower.includes("quantity")) {
      updated.quantity = undefined;
    }

    setEditedRequirement(updated);
  };

  // Convert understood requirement into an RFQ
  const handleCreateRfq = () => {
    if (!editedRequirement) return;

    const params = new URLSearchParams();
    params.set("title", `RFQ: ${editedRequirement.quantity ? `${editedRequirement.quantity} ${editedRequirement.unit || "units"} of ` : ""}${editedRequirement.product}`);
    if (editedRequirement.product) params.set("product", editedRequirement.product);
    if (editedRequirement.quantity) params.set("quantity", String(editedRequirement.quantity));
    if (editedRequirement.unit) params.set("unit", editedRequirement.unit);
    if (editedRequirement.origin_country) params.set("origin_country", editedRequirement.origin_country);
    if (editedRequirement.destination_country) params.set("destination_country", editedRequirement.destination_country);
    if (editedRequirement.destination_port) params.set("destination_port", editedRequirement.destination_port);
    if (editedRequirement.delivery_days) params.set("lead_time_days", String(editedRequirement.delivery_days));
    if (editedRequirement.incoterm) params.set("incoterm", editedRequirement.incoterm);
    if (editedRequirement.certifications?.length) params.set("certifications", editedRequirement.certifications.join(","));

    navigate(`/rfq?${params.toString()}`);
  };

  // Save search
  const handleSaveSearch = () => {
    setIsSaved(true);
    try {
      const saved = JSON.parse(localStorage.getItem("tradex_saved_searches") || "[]");
      if (searchResponse && !saved.includes(searchResponse.query)) {
        saved.unshift(searchResponse.query);
        localStorage.setItem("tradex_saved_searches", JSON.stringify(saved.slice(0, 50)));
      }
    } catch {
      // Ignore storage errors
    }
  };

  // Request quote for a specific supplier
  const handleRequestQuote = (supplierId: string, supplierName: string) => {
    const params = new URLSearchParams();
    params.set("supplier_id", supplierId);
    params.set("supplier_name", supplierName);
    if (editedRequirement?.product) params.set("product", editedRequirement.product);
    if (editedRequirement?.quantity) params.set("quantity", String(editedRequirement.quantity));
    if (editedRequirement?.unit) params.set("unit", editedRequirement.unit);

    navigate(`/rfq?${params.toString()}`);
  };

  return (
    <div className="min-w-0 flex-1 space-y-8 pb-16">
      {/* Search Hero */}
      <AiSearchHero
        initialQuery={currentQuery}
        isLoading={isLoading}
        onSearch={(q) => {
          setCurrentQuery(q);
          executeSearch(q);
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={historyItems.length}
      />

      {/* Streaming Progress Bar */}
      <StreamingProgressLine isLoading={isLoading} />

      {/* Error state */}
      {error && (
        <ErrorState
          title="Search Failed"
          message={error}
          onRetry={() => executeSearch(currentQuery)}
        />
      )}

      {/* Results Container */}
      {searchResponse && !isLoading && (
        <div className="space-y-6">
          {/* Understood Requirement Card */}
          {editedRequirement && (
            <UnderstoodRequirementCard
              requirement={editedRequirement}
              missingFields={searchResponse.missing_fields}
              clarifyingQuestions={searchResponse.clarifying_questions}
              executionTimeMs={searchResponse.execution_time_ms}
              isMock={searchResponse.is_mock}
              onRequirementChange={handleRequirementChange}
              onCreateRfq={handleCreateRfq}
              onSaveSearch={handleSaveSearch}
              isSaved={isSaved}
            />
          )}

          {/* Filter Relaxation Suggestions if matches are scarce */}
          {searchResponse.relaxation_suggestions &&
            searchResponse.relaxation_suggestions.length > 0 &&
            (filteredSuppliers.length === 0 || filteredProducts.length === 0) && (
              <FilterRelaxationSuggestions
                suggestions={searchResponse.relaxation_suggestions}
                onApplySuggestion={handleApplyRelaxation}
              />
            )}

          {/* Results Tabs: Suppliers & Products */}
          <AiSearchResultsTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            suppliers={filteredSuppliers}
            products={filteredProducts}
            onRequestQuote={handleRequestQuote}
            onOpenBreakdown={setBreakdownSupplier}
          />
        </div>
      )}

      {/* Search History Drawer */}
      <SearchHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyItems={historyItems}
        onSelectQuery={(q) => {
          setCurrentQuery(q);
          executeSearch(q);
        }}
        isLoading={isHistoryLoading}
      />

      {/* Why This Score Breakdown Drawer */}
      <ScoreBreakdownDrawer
        isOpen={Boolean(breakdownSupplier)}
        onClose={() => setBreakdownSupplier(null)}
        supplier={breakdownSupplier}
      />
    </div>
  );
};
