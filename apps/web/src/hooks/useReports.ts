import { useQuery } from "@tanstack/react-query";
import {
  fetchReports,
  type ReportBounds,
  type ReportFilters,
} from "../api/reports";

export function useReports(
  bounds?: ReportBounds | null,
  filters: ReportFilters = {},
) {
  return useQuery({
    queryKey: ["reports", bounds, filters],
    queryFn: () => fetchReports(bounds, filters),
    staleTime: 30_000,
    retry: false,
  });
}
