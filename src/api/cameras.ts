import { apiGet, apiPost, apiFetch, apiPut, apiDelete } from "../lib/api";
import type { ApiCamera } from "../types";

export function fetchCameras(): Promise<ApiCamera[]> {
  return apiGet("/api/cameras");
}

export interface CreateCameraPayload {
  name: string;
  location?: string;
  source: string;
  zone_id?: number | null;
}

export function createCamera(payload: CreateCameraPayload): Promise<ApiCamera> {
  return apiPost("/api/cameras", payload);
}

export function fetchZones(): Promise<{ id: number; name: string }[]> {
  return apiGet("/api/zones");
}

export interface CreatedZone { id: number; name: string; created_at: string | null }

export function createZone(name: string): Promise<CreatedZone> {
  return apiPost("/api/zones", { name });
}

export interface UploadedVideo { filename: string; size_bytes: number }

// Uses apiFetch directly, not apiPost — apiPost always JSON-encodes its
// body and sets Content-Type: application/json, which would break a real
// file upload. A FormData body needs the browser to set its own
// multipart/form-data boundary header automatically, so no Content-Type
// is set here at all. apiFetch still attaches the same auth token as
// every other request, since that logic lives there, not in apiPost.
export async function uploadVideo(file: File): Promise<UploadedVideo> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/api/videos/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Upload failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.detail) {
        message = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      }
    } catch {
      // response wasn't JSON — keep the generic status-based message
    }
    throw new Error(message);
  }
  return res.json();
}

export function updateCamera(id: number, payload: Partial<CreateCameraPayload>): Promise<ApiCamera> {
  return apiPut(`/api/cameras/${id}`, payload);
}

export function deleteCamera(id: number): Promise<{ status: string; id: number }> {
  return apiDelete(`/api/cameras/${id}`);
}
