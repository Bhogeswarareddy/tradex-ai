import { useState, useEffect } from "react";
import { api } from "../lib/api/client";
import { HealthStatus } from "../lib/api/types";

export function useHealth() {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const health = await api.checkHealth();
      setData(health);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to TradeX backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return { data, loading, error, refetch: fetchHealth };
}
