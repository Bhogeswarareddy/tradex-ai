import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  aiSearchApi,
  AiSearchResponse,
  AiSearchHistoryItem,
  SavedSearchItem,
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
import { ErrorBoundary } from "../components/common/ErrorBoundary";

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
  const [savedSearchId, setSavedSearchId] = useState<string | null>(null);
  const [breakdownSupplier, setBreakdownSupplier] = useState<any | null>(null);

  // History & Saved Searches state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<AiSearchHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Stale Results Prevention: Track active AbortController and latest sequential requestId
  const activeAbortRef = useRef<AbortController | null>(null);
  const latestRequestIdRef = useRef<number>(0);

  // Fetch search history and database-backed saved searches
  const loadHistoryAndSaved = useCallback(async () => {
    try {
      setIsHistoryLoading(true);
      const [hist, saved] = await Promise.all([
        aiSearchApi.getHistory().catch(() => []),
        aiSearchApi.getSavedSearches().catch(() => []),
      ]);
      setHistoryItems(hist);
      setSavedSearches(saved);
    } catch {
      // Non-critical
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistoryAndSaved();
  }, [loadHistoryAndSaved]);

  // Execute Search with AbortController and requestId guards
  const executeSearch = useCallback(
    async (queryText: string, preservedRequirement?: ExtractedRequirement) => {
      const trimmed = queryText.trim();
      if (!trimmed) return;

      // 1. Cancel previous in-flight request immediately
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
      const controller = new AbortController();
      activeAbortRef.current = controller;

      // 2. Increment request ID to ensure out-of-order responses are rejected
      const requestId = ++latestRequestIdRef.current;
      const timeoutId = setTimeout(() => {
        controller.abort("Search request timed out after 30 seconds");
      }, 30000);

      setIsLoading(true);
      setError(null);
      setIsSaved(false);
      setSavedSearchId(null);

      // Update URL query string
      setSearchParams({ q: trimmed });

      try {
        const response = await aiSearchApi.search(trimmed, controller.signal);

        // Check if this response matches the most recent request
        if (requestId !== latestRequestIdRef.current) {
          return;
        }

        setSearchResponse(response);
        setEditedRequirement(preservedRequirement || response.requirement);

        // Check if this search was already saved in user's savedSearches
        loadHistoryAndSaved();
      } catch (err: any) {
        if (err.name === "AbortError" && !String(err.message || "").includes("timed out")) {
          // Request was aborted by newer search, do not set error state
          return;
        }
        if (requestId === latestRequestIdRef.current) {
          const msg = String(err.message || "").includes("timed out")
            ? "Search request timed out after 30 seconds. Please try again or refine your query."
            : (err.message || "Failed to parse trade search query. Please try again.");
          setError(msg);
        }
      } finally {
        clearTimeout(timeoutId);
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [setSearchParams, loadHistoryAndSaved]
  );

  // Auto-search if q is present in URL on initial mount
  useEffect(() => {
    if (queryParam && (!searchResponse || searchResponse.query !== queryParam)) {
      setCurrentQuery(queryParam);
      executeSearch(queryParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam]);

  // Filtered suppliers: use response suppliers with fallback
  const filteredSuppliers = useMemo(() => {
    if (!searchResponse) return [];
    if (!editedRequirement) return searchResponse.suppliers;

    return searchResponse.suppliers.filter((s) => {
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
      if (editedRequirement.product) {
        const needle = editedRequirement.product.toLowerCase();
        const inName = p.name.toLowerCase().includes(needle);
        const inCat = p.category_name.toLowerCase().includes(needle);
        if (!inName && !inCat) return false;
      }
      if (
        editedRequirement.origin_country &&
        !p.origin_country.toLowerCase().includes(editedRequirement.origin_country.toLowerCase())
      ) {
        return false;
      }
      if (
        editedRequirement.delivery_days !== undefined &&
        p.lead_time_days > editedRequirement.delivery_days
      ) {
        return false;
      }
      return true;
    });
  }, [searchResponse, editedRequirement]);

  // Handle client-side requirement chip modification: immediately re-query structured filter endpoint
  const handleRequirementChange = async (updated: ExtractedRequirement) => {
    setEditedRequirement(updated);

    // Call fast marketplace re-filter endpoint without re-calling the LLM
    try {
      const filteredRes = await aiSearchApi.filter(updated);
      setSearchResponse((prev) =>
        prev
          ? {
              ...prev,
              products: filteredRes.products,
              suppliers: filteredRes.suppliers,
              relaxation_suggestions: filteredRes.relaxation_suggestions,
            }
          : filteredRes
      );
    } catch {
      // Local useMemo filtering handles UI smoothly if backend filter fails
    }
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

    handleRequirementChange(updated);
  };

  // Convert understood requirement into an RFQ with all trade parameters
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

  // Database-backed Save & Unsave Search
  const handleSaveSearch = async () => {
    if (isSaved && savedSearchId) {
      try {
        await aiSearchApi.unsaveSearch(savedSearchId);
        setIsSaved(false);
        setSavedSearchId(null);
        loadHistoryAndSaved();
      } catch {
        // Fallback
      }
      return;
    }

    setIsSaved(true);
    try {
      const res = await aiSearchApi.saveSearch(
        undefined,
        searchResponse?.query || currentQuery,
        editedRequirement,
        searchResponse?.filters
      );
      setSavedSearchId(res.search_id);
      loadHistoryAndSaved();
    } catch {
      // Local fallback
    }
  };

  const handleUnsaveSearchItem = async (searchId: string) => {
    try {
      await aiSearchApi.unsaveSearch(searchId);
      if (savedSearchId === searchId) {
        setIsSaved(false);
        setSavedSearchId(null);
      }
      loadHistoryAndSaved();
    } catch {
      // Ignore
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
    if (editedRequirement?.destination_country) params.set("destination_country", editedRequirement.destination_country);

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
            <ErrorBoundary level="widget" fallbackTitle="Requirement details display encountered an issue">
              <UnderstoodRequirementCard
                requirement={editedRequirement}
                missingFields={searchResponse.missing_fields}
                clarifyingQuestions={searchResponse.clarifying_questions}
                executionTimeMs={searchResponse.execution_time_ms}
                isMock={searchResponse.is_mock}
                aiMeta={searchResponse.ai_meta}
                onRequirementChange={handleRequirementChange}
                onCreateRfq={handleCreateRfq}
                onSaveSearch={handleSaveSearch}
                isSaved={isSaved}
              />
            </ErrorBoundary>
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
          <ErrorBoundary level="widget" fallbackTitle="Marketplace search matches encountered an issue">
            <AiSearchResultsTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              suppliers={filteredSuppliers}
              products={filteredProducts}
              onRequestQuote={handleRequestQuote}
              onOpenBreakdown={setBreakdownSupplier}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Search History Drawer */}
      <SearchHistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        historyItems={historyItems}
        savedSearches={savedSearches}
        onSelectQuery={(q, req) => {
          setCurrentQuery(q);
          executeSearch(q, req);
        }}
        onUnsaveSearch={handleUnsaveSearchItem}
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
