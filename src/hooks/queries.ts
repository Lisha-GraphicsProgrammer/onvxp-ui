import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchIncidentsPage, fetchLatestIncident, fetchStats } from "../api/incidents";
import { fetchCameras, createCamera, fetchZones, createZone, uploadVideo, updateCamera, deleteCamera, type CreateCameraPayload } from "../api/cameras";
import { fetchAnalytics } from "../api/analytics";

const POLL_MS = 5_000;

// Query keys, centralized. All incident keys share the ["incidents"] prefix,
// so Task 9's review mutation can invalidate every incident view at once:
//   queryClient.invalidateQueries({ queryKey: ["incidents"] })
export const keys = {
  incidentsPage: (page: number, pageSize: number) => ["incidents", "page", page, pageSize] as const,
  incidentsLatest: ["incidents", "latest"] as const,
  stats: ["stats"] as const,
  cameras: ["cameras"] as const,
  zones: ["zones"] as const,
  analytics: (from: string, to: string, period: string) => ["analytics", from, to, period] as const,
};

export function useIncidentsPage(page: number, pageSize: number) {
  return useQuery({
    queryKey: keys.incidentsPage(page, pageSize),
    queryFn: () => fetchIncidentsPage(page, pageSize),
    refetchInterval: POLL_MS,
    // keep current rows on screen while the next page loads
    placeholderData: (prev) => prev,
  });
}

export function useLatestIncident() {
  return useQuery({ queryKey: keys.incidentsLatest, queryFn: fetchLatestIncident, refetchInterval: POLL_MS });
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: fetchStats, refetchInterval: POLL_MS });
}

export function useCameras() {
  return useQuery({ queryKey: keys.cameras, queryFn: fetchCameras, refetchInterval: POLL_MS });
}

export function useAnalytics(fromDate: string, toDate: string, period: "day" | "week" | "month") {
  return useQuery({
    queryKey: keys.analytics(fromDate, toDate, period),
    queryFn: () => fetchAnalytics(fromDate, toDate, period),
    placeholderData: (prev) => prev,
  });
}

export function useZones() {
  return useQuery({ queryKey: keys.zones, queryFn: fetchZones });
}

// Lets the Add Camera modal create a zone inline, without leaving the
// form — invalidates the zone list so the new zone appears immediately,
// and hands the created zone back to the caller so it can be auto-selected.
export function useCreateZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createZone(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.zones });
    },
  });
}

export function useUploadVideo() {
  return useMutation({ mutationFn: (file: File) => uploadVideo(file) });
}

// Invalidates the camera list immediately on success rather than waiting
// for the next 5s poll — a newly-added camera should appear right away,
// not after a visible delay.
export function useCreateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCameraPayload) => createCamera(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cameras });
    },
  });
}

export function useUpdateCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateCameraPayload> }) =>
      updateCamera(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cameras });
    },
  });
}

export function useDeleteCamera() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCamera(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.cameras });
    },
  });
}
