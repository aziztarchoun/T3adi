import { useQuery } from "@tanstack/react-query";
import { fetchReports } from "../api/reports";

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: fetchReports,
    staleTime: 30_000,
  });
}
