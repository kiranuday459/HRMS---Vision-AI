import { useEffect, useState } from "react";
import api from "../utils/api";


let cached = null;
let fetchedAt = 0;

export default function useEmployees() {
  const [employees, setEmployees] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  const fetchEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/api/employees");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load employees");
      }
      const json = await res.json();
      const list = json.data || json || [];
      cached = list;
      fetchedAt = Date.now();
      setEmployees(list);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(err.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reuse cache if fetched within last 5 minutes
    if (cached && Date.now() - fetchedAt < 1000 * 60 * 5) {
      setEmployees(cached);
      setLoading(false);
      return;
    }
    fetchEmployees();
  }, []);

  const refresh = () => fetchEmployees();

  return { employees, loading, error, refresh };
}
