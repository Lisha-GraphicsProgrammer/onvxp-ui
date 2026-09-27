import { useState, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { Box, Typography } from "@mui/material";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import PageHeader from "../../components/layout/PageHeader";
import { FilterDropdown } from "../../components/common/Dropdown";
import { useTheme } from "../../context/ThemeContext";
import {
  useCameras,
  useLatestIncident,
  useZones,
  useCreateCamera,
  useCreateZone,
  useUploadVideo,
  useUpdateCamera,
  useDeleteCamera,
} from "../../hooks/queries";
import { ACCENT, GREEN } from "../../lib/constants";
import type { ApiCamera } from "../../types";

type SourceType = "rtsp" | "http" | "file" | "phone";

// A camera's connection details assembled into the single "source" string
// the backend already expects. _validate_source() in api_server.py already
// handles an rtsp:// URL, a plain filename, or a numeric webcam index —
// this is what builds that string from the type-specific fields the user
// actually fills in, so any camera speaking a standard protocol (a real
// CCTV unit, an NVR, or a phone running an IP-camera app) works the same
// way, without needing separate code per device.
//
// "phone" isn't a genuinely different protocol — a phone running an
// IP-camera app exposes an ordinary HTTP/MJPEG stream, identical to the
// plain HTTP type below. It gets its own tab purely because most people
// setting up a phone don't know the URL shape, so this pre-fills the
// port/path convention used by the most common apps (e.g. "IP Webcam" on
// Android) instead of asking someone to type a raw URL.
function buildSourceString(
  type: SourceType,
  fields: {
    host: string;
    port: string;
    username: string;
    password: string;
    path: string;
    httpUrl: string;
    fileName: string;
    phonePort: string;
    phonePath: string;
  },
): string {
  if (type === "file") return fields.fileName.trim();
  if (type === "http") return fields.httpUrl.trim();
  if (type === "phone") {
    const port = fields.phonePort.trim() || "8080";
    let path = fields.phonePath.trim() || "/video";
    if (!path.startsWith("/")) path = `/${path}`;
    return `http://${fields.host.trim()}:${port}${path}`;
  }
  const auth = fields.username.trim()
    ? `${fields.username.trim()}:${fields.password}@`
    : "";
  const port = fields.port.trim() || "554";
  let path = fields.path.trim();
  if (path && !path.startsWith("/")) path = `/${path}`;
  return `rtsp://${auth}${fields.host.trim()}:${port}${path}`;
}

// The inverse of buildSourceString — given an existing camera's stored
// source string, reconstructs which connection type and fields produced
// it, so editing a camera can start from its real current values instead
// of a blank form. Best-effort: an http:// URL could originally have come
// from either the plain HTTP/MJPEG type or the Phone type (they produce
// identical URLs), so it's shown back as HTTP/MJPEG either way — editing
// it there still works correctly, since both send the same kind of URL.
function parseSourceForEdit(source: string): Partial<typeof DEFAULT_FORM> {
  if (source.startsWith("rtsp://")) {
    const rest = source.slice("rtsp://".length);
    const atIndex = rest.indexOf("@");
    const authPart = atIndex !== -1 ? rest.slice(0, atIndex) : "";
    const afterAuth = atIndex !== -1 ? rest.slice(atIndex + 1) : rest;

    let username = "";
    let password = "";
    if (authPart) {
      const colonIndex = authPart.indexOf(":");
      if (colonIndex !== -1) {
        username = authPart.slice(0, colonIndex);
        password = authPart.slice(colonIndex + 1);
      } else {
        username = authPart;
      }
    }

    const slashIndex = afterAuth.indexOf("/");
    const hostPort =
      slashIndex !== -1 ? afterAuth.slice(0, slashIndex) : afterAuth;
    const path = slashIndex !== -1 ? afterAuth.slice(slashIndex) : "";

    const colonIndex2 = hostPort.lastIndexOf(":");
    const host = colonIndex2 !== -1 ? hostPort.slice(0, colonIndex2) : hostPort;
    const port = colonIndex2 !== -1 ? hostPort.slice(colonIndex2 + 1) : "554";

    return { sourceType: "rtsp", host, port, username, password, path };
  }
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return { sourceType: "http", httpUrl: source };
  }
  // Anything else — a plain filename or a numeric webcam index — is
  // treated as the Video file type, same as how it was originally created.
  return { sourceType: "file", fileName: source };
}

// A camera from the API may not yet have zone_id/zone_name in its declared
// type if types.ts hasn't been updated since the zone/camera restructure —
// accessed defensively here rather than assuming the shape.
type CameraWithZone = ApiCamera & {
  zone_name?: string | null;
  zone_id?: number | null;
  source?: string | null;
};

const DEFAULT_FORM = {
  name: "",
  zoneId: "" as number | "",
  sourceType: "rtsp" as SourceType,
  host: "",
  port: "554",
  username: "",
  password: "",
  path: "",
  httpUrl: "",
  fileName: "",
  phonePort: "8080",
  phonePath: "/video",
};

// Native <input>/<select> elements, hand-styled to match this file's own
// dark design system (t.*) directly — plain MUI TextField/Select would
// instead pull from MUI's own default (light) theme, which is a
// completely separate system from this app's ThemeContext and renders
// visibly broken sitting inside a custom-styled dark modal.
function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  sx,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  sx?: object;
  required?: boolean;
}) {
  const { t } = useTheme();
  return (
    <Box sx={{ flex: 1, minWidth: 0, ...sx }}>
      <Typography
        sx={{
          color: t.textMuted,
          fontSize: ".72rem",
          fontWeight: 600,
          mb: 0.6,
        }}
      >
        {label.toUpperCase()}
        {required && (
          <Box component="span" sx={{ color: "#E74C3C" }}>
            {" "}
            *
          </Box>
        )}
      </Typography>
      <Box
        component="input"
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        sx={{
          width: "100%",
          boxSizing: "border-box",
          padding: "9px 12px",
          borderRadius: "8px",
          border: `1px solid ${t.border}`,
          background: t.bg,
          color: t.text,
          fontSize: ".85rem",
          fontFamily: "inherit",
          outline: "none",
          "&:focus": { borderColor: ACCENT },
          "&::placeholder": { color: t.textMuted },
        }}
      />
    </Box>
  );
}

function ZoneSelect({
  value,
  onChange,
  zones,
  onCreateZone,
  creating,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  zones: { id: number; name: string }[];
  onCreateZone: (name: string) => void;
  creating: boolean;
}) {
  const { t } = useTheme();
  const [showNewZone, setShowNewZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");

  const submitNewZone = () => {
    const name = newZoneName.trim();
    if (!name || creating) return;
    onCreateZone(name);
    setNewZoneName("");
    setShowNewZone(false);
  };

  return (
    <Box>
      <Typography
        sx={{
          color: t.textMuted,
          fontSize: ".72rem",
          fontWeight: 600,
          mb: 0.6,
        }}
      >
        ZONE
        <Box component="span" sx={{ color: "#E74C3C" }}>
          {" "}
          *
        </Box>
      </Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        <FilterDropdown
          value={value === "" ? "" : String(value)}
          onChange={(v) => onChange(v === "" ? "" : Number(v))}
          options={zones.map((z) => ({ value: String(z.id), label: z.name }))}
          placeholder={
            zones.length ? "Select a zone…" : "No zones yet — create one"
          }
          flex={1}
          minWidth={0}
        />
        <Box
          onClick={() => setShowNewZone((s) => !s)}
          title={showNewZone ? "Cancel" : "Create a new zone"}
          sx={{
            width: 38,
            height: 38,
            flexShrink: 0,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: showNewZone ? "#E74C3C" : t.textMuted,
            border: `1px solid ${showNewZone ? "#E74C3C" : t.border}`,
            background: showNewZone ? "#E74C3C18" : "transparent",
            "&:hover": {
              color: showNewZone ? "#E74C3C" : ACCENT,
              borderColor: showNewZone ? "#E74C3C" : ACCENT,
            },
          }}
        >
          {showNewZone ? (
            <CloseIcon sx={{ fontSize: 18 }} />
          ) : (
            <AddIcon sx={{ fontSize: 18 }} />
          )}
        </Box>
      </Box>

      {showNewZone && (
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Box
            component="input"
            autoFocus
            value={newZoneName}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setNewZoneName(e.target.value)
            }
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter") submitNewZone();
            }}
            placeholder="New zone name"
            sx={{
              flex: 1,
              minWidth: 0,
              boxSizing: "border-box",
              padding: "8px 12px",
              borderRadius: "8px",
              border: `1px solid ${t.border}`,
              background: t.bg,
              color: t.text,
              fontSize: ".82rem",
              fontFamily: "inherit",
              outline: "none",
              "&:focus": { borderColor: ACCENT },
            }}
          />
          <Box
            onClick={submitNewZone}
            sx={{
              px: 1.6,
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              fontSize: ".8rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor:
                creating || !newZoneName.trim() ? "not-allowed" : "pointer",
              background: ACCENT,
              color: "#fff",
              opacity: creating || !newZoneName.trim() ? 0.6 : 1,
            }}
          >
            {creating ? "Adding…" : "Add zone"}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default function CamerasPage() {
  const { t } = useTheme();
  const [selectedCam, setSelectedCam] = useState<CameraWithZone | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showAdvancedRtsp, setShowAdvancedRtsp] = useState(false);
  const [editingCameraId, setEditingCameraId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CameraWithZone | null>(null);

  const { data: camerasData, isError: camError } = useCameras();
  const { data: latestIncident, isError: incError } = useLatestIncident();
  const { data: zonesData } = useZones();
  const createCameraMutation = useCreateCamera();
  const updateCameraMutation = useUpdateCamera();
  const deleteCameraMutation = useDeleteCamera();
  const createZoneMutation = useCreateZone();
  const uploadVideoMutation = useUploadVideo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateZone = (name: string) => {
    createZoneMutation.mutate(name, {
      onSuccess: (newZone) => setForm((f) => ({ ...f, zoneId: newZone.id })),
    });
  };

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadVideoMutation.mutate(file, {
      onSuccess: (uploaded) =>
        setForm((f) => ({ ...f, fileName: uploaded.filename })),
    });
    // allows picking the exact same file again later without the browser
    // silently ignoring it because the input's value didn't change
    e.target.value = "";
  };

  const cameras: CameraWithZone[] = camerasData ?? [];
  const zones = zonesData ?? [];
  const lastDetection: string | null = latestIncident?.timestamp ?? null;
  const apiError = camError || incError;

  const resetAndClose = () => {
    setAddOpen(false);
    setForm(DEFAULT_FORM);
    createCameraMutation.reset();
    updateCameraMutation.reset();
    setShowAdvancedRtsp(false);
    setEditingCameraId(null);
  };

  const handleEditClick = (cam: CameraWithZone) => {
    setEditingCameraId(cam.id);
    setForm({
      ...DEFAULT_FORM,
      name: cam.name,
      zoneId: cam.zone_id ?? "",
      ...parseSourceForEdit(cam.source || ""),
    });
    setAddOpen(true);
  };

  const handleAddCamera = () => {
    const source = buildSourceString(form.sourceType, form);
    const payload = {
      name: form.name.trim() || "Unnamed Camera",
      source,
      zone_id: form.zoneId === "" ? null : form.zoneId,
    };
    if (editingCameraId) {
      updateCameraMutation.mutate(
        { id: editingCameraId, payload },
        { onSuccess: resetAndClose },
      );
    } else {
      createCameraMutation.mutate(payload, { onSuccess: resetAndClose });
    }
  };

  const activeMutation = editingCameraId
    ? updateCameraMutation
    : createCameraMutation;

  const canSubmit =
    form.name.trim().length > 0 &&
    form.zoneId !== "" &&
    (form.sourceType === "rtsp"
      ? form.host.trim().length > 0
      : form.sourceType === "phone"
        ? form.host.trim().length > 0
        : form.sourceType === "http"
          ? form.httpUrl.trim().length > 0
          : form.fileName.trim().length > 0);

  const onlineCount = cameras.filter((c) => c.status === "online").length;
  const offlineCount = cameras.filter((c) => c.status === "offline").length;

  const statCards = [
    {
      val: String(cameras.length),
      label: "Total cameras",
      color: t.textMuted,
      icon: <VideocamIcon sx={{ fontSize: 19 }} />,
    },
    {
      val: String(onlineCount),
      label: "Online",
      color: GREEN,
      icon: <CheckCircleIcon sx={{ fontSize: 19 }} />,
    },
    {
      val: String(offlineCount),
      label: "Offline",
      color: "#E74C3C",
      icon: <VideocamOffIcon sx={{ fontSize: 19 }} />,
    },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <PageHeader
        title="Camera Management"
        description={
          apiError
            ? "Couldn't reach the camera service — try refreshing"
            : "Live feeds and status for every camera on site"
        }
      />

      <Box sx={{ p: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2.5 }}>
          <Box
            onClick={() => setAddOpen(true)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.8,
              px: 2,
              py: 1,
              borderRadius: "10px",
              background: ACCENT,
              color: "#fff",
              fontSize: ".82rem",
              fontWeight: 600,
              cursor: "pointer",
              "&:hover": { opacity: 0.9 },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} />
            Add Camera
          </Box>
        </Box>

        {/* Stat cards — plain, no decorative glow, matches the picker
        card treatment used elsewhere: hairline border, subtle shadow. */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 2,
            mb: 4,
          }}
        >
          {statCards.map((s, i) => (
            <Box
              key={i}
              sx={{
                p: "18px 20px",
                borderRadius: "14px",
                background: t.surface,
                border: `1px solid ${t.border}`,
                display: "flex",
                alignItems: "center",
                gap: 1.8,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: `${s.color}15`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: s.color,
                  flexShrink: 0,
                }}
              >
                {s.icon}
              </Box>
              <Box>
                <Typography
                  sx={{
                    fontSize: "1.3rem",
                    fontWeight: 700,
                    color: t.text,
                    lineHeight: 1.1,
                  }}
                >
                  {s.val}
                </Typography>
                <Typography
                  sx={{ color: t.textMuted, fontSize: ".78rem", mt: "2px" }}
                >
                  {s.label}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Camera expand modal */}
        {selectedCam && (
          <Box
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedCam(null);
            }}
            sx={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                width: "min(900px, 90vw)",
                borderRadius: "16px",
                overflow: "hidden",
                background: t.bgSecondary,
                border: `1px solid ${t.border}`,
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              }}
            >
              <Box
                sx={{
                  px: 2.5,
                  py: 1.6,
                  borderBottom: `1px solid ${t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: ACCENT,
                    }}
                  />
                  <Typography
                    sx={{ color: t.text, fontWeight: 600, fontSize: ".9rem" }}
                  >
                    {selectedCam.name}
                  </Typography>
                </Box>
                <Box
                  onClick={() => setSelectedCam(null)}
                  sx={{
                    cursor: "pointer",
                    color: t.textMuted,
                    display: "flex",
                    "&:hover": { color: t.text },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 20 }} />
                </Box>
              </Box>
              {selectedCam.stream_url ? (
                <img
                  src={selectedCam.stream_url}
                  alt="Live stream"
                  style={{
                    width: "100%",
                    display: "block",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    background: "#000",
                  }}
                />
              ) : (
                <Box
                  sx={{
                    height: 400,
                    background: t.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 1.5,
                  }}
                >
                  <VideocamOffIcon sx={{ fontSize: 40, color: t.textMuted }} />
                  <Typography sx={{ color: t.textMuted, fontSize: ".85rem" }}>
                    No stream available
                  </Typography>
                </Box>
              )}
              <Box sx={{ px: 2.5, py: 1.4, display: "flex", gap: 3 }}>
                {selectedCam.zone_name && (
                  <Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>
                    {selectedCam.zone_name}
                  </Typography>
                )}
                <Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>
                  {selectedCam.fps} fps
                </Typography>
                <Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>
                  {selectedCam.resolution}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}

        {/* Add Camera modal */}
        {addOpen && (
          <Box
            onClick={(e) => {
              if (e.target === e.currentTarget) resetAndClose();
            }}
            sx={{
              position: "fixed",
              inset: 0,
              zIndex: 200,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                width: "min(520px, 92vw)",
                maxHeight: "88vh",
                display: "flex",
                flexDirection: "column",
                borderRadius: "16px",
                background: t.bgSecondary,
                border: `1px solid ${t.border}`,
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  px: 2.5,
                  py: 1.6,
                  borderBottom: `1px solid ${t.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  sx={{ color: t.text, fontWeight: 600, fontSize: ".95rem" }}
                >
                  {editingCameraId ? "Edit Camera" : "Add Camera"}
                </Typography>
                <Box
                  onClick={resetAndClose}
                  sx={{
                    cursor: "pointer",
                    color: t.textMuted,
                    display: "flex",
                    "&:hover": { color: t.text },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 20 }} />
                </Box>
              </Box>

              <Box
                sx={{
                  p: 2.5,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  overflowY: "auto",
                  "&::-webkit-scrollbar": { width: "8px" },
                  "&::-webkit-scrollbar-track": { background: "transparent" },
                  "&::-webkit-scrollbar-thumb": {
                    background: t.border,
                    borderRadius: "4px",
                  },
                  "&::-webkit-scrollbar-thumb:hover": {
                    background: t.textMuted,
                  },
                }}
              >
                <LabeledInput
                  label="Camera name"
                  required
                  placeholder="e.g. Loading Zone Camera"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                />
                <ZoneSelect
                  value={form.zoneId}
                  onChange={(v) => setForm((f) => ({ ...f, zoneId: v }))}
                  zones={zones}
                  onCreateZone={handleCreateZone}
                  creating={createZoneMutation.isPending}
                />

                {/* Connection type — any device speaking one of these
                standard protocols works the same way: a real CCTV camera,
                an NVR channel, or a phone running an IP-camera app. */}
                <Box>
                  <Typography
                    sx={{
                      color: t.textMuted,
                      fontSize: ".75rem",
                      mb: 0.8,
                      fontWeight: 600,
                    }}
                  >
                    CONNECTION TYPE
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {(
                      [
                        { v: "rtsp", label: "RTSP" },
                        { v: "phone", label: "Phone camera" },
                        { v: "http", label: "HTTP / MJPEG" },
                        { v: "file", label: "Video file" },
                      ] as const
                    ).map((opt) => {
                      const active = form.sourceType === opt.v;
                      return (
                        <Box
                          key={opt.v}
                          onClick={() =>
                            setForm((f) => ({ ...f, sourceType: opt.v }))
                          }
                          sx={{
                            flex: 1,
                            textAlign: "center",
                            py: 0.9,
                            borderRadius: "8px",
                            fontSize: ".78rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            border: `1px solid ${active ? ACCENT : t.border}`,
                            background: active ? `${ACCENT}18` : "transparent",
                            color: active ? ACCENT : t.textMuted,
                          }}
                        >
                          {opt.label}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                {form.sourceType === "rtsp" && (
                  <>
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                      <LabeledInput
                        label="Camera IP"
                        required
                        placeholder="192.168.1.50"
                        value={form.host}
                        onChange={(v) => setForm((f) => ({ ...f, host: v }))}
                      />
                      <LabeledInput
                        label="Port"
                        placeholder="554"
                        value={form.port}
                        onChange={(v) => setForm((f) => ({ ...f, port: v }))}
                        sx={{ flex: "0 0 90px" }}
                      />
                    </Box>

                    <Box
                      onClick={() => setShowAdvancedRtsp((s) => !s)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.6,
                        cursor: "pointer",
                        color: ACCENT,
                        py: 0.5,
                        "&:hover": { opacity: 0.8 },
                      }}
                    >
                      <ExpandMoreIcon
                        sx={{
                          fontSize: 19,
                          transition: "transform .15s",
                          transform: showAdvancedRtsp
                            ? "rotate(180deg)"
                            : "none",
                        }}
                      />
                      <Typography
                        sx={{
                          fontSize: ".8rem",
                          fontWeight: 700,
                          color: ACCENT,
                        }}
                      >
                        Advanced settings
                      </Typography>
                    </Box>

                    {showAdvancedRtsp && (
                      <>
                        <Box sx={{ display: "flex", gap: 1.5 }}>
                          <LabeledInput
                            label="Username"
                            value={form.username}
                            placeholder="User Name"
                            onChange={(v) =>
                              setForm((f) => ({ ...f, username: v }))
                            }
                          />
                          <LabeledInput
                            label="Password"
                            type="password"
                            placeholder="Password"
                            value={form.password}
                            onChange={(v) =>
                              setForm((f) => ({ ...f, password: v }))
                            }
                          />
                        </Box>
                        <LabeledInput
                          label="Stream path"
                          placeholder="/stream1"
                          value={form.path}
                          onChange={(v) => setForm((f) => ({ ...f, path: v }))}
                        />
                      </>
                    )}

                    <Typography sx={{ color: t.textMuted, fontSize: ".72rem" }}>
                      Will connect to: rtsp://
                      {form.username ? `${form.username}:••••@` : ""}
                      {form.host || "camera-ip"}:{form.port || "554"}
                      {form.path
                        ? form.path.startsWith("/")
                          ? form.path
                          : `/${form.path}`
                        : ""}
                    </Typography>
                  </>
                )}

                {form.sourceType === "phone" && (
                  <>
                    <Typography
                      sx={{
                        color: t.textMuted,
                        fontSize: ".76rem",
                        lineHeight: 1.5,
                      }}
                    >
                      Install an IP-camera app on the phone (e.g. "IP Webcam" on
                      Android, "EpocCam" on iOS), start it, and make sure the
                      phone is on the same Wi-Fi network as this computer. The
                      app will show an IP address — enter it below.
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1.5 }}>
                      <LabeledInput
                        label="Phone's IP address"
                        required
                        placeholder="192.168.1.42"
                        value={form.host}
                        onChange={(v) => setForm((f) => ({ ...f, host: v }))}
                      />
                      <LabeledInput
                        label="Port"
                        placeholder="8080"
                        value={form.phonePort}
                        onChange={(v) =>
                          setForm((f) => ({ ...f, phonePort: v }))
                        }
                        sx={{ flex: "0 0 90px" }}
                      />
                    </Box>
                    <LabeledInput
                      label="Stream path"
                      placeholder="/video"
                      value={form.phonePath}
                      onChange={(v) => setForm((f) => ({ ...f, phonePath: v }))}
                    />
                    <Typography sx={{ color: t.textMuted, fontSize: ".72rem" }}>
                      Will connect to: http://{form.host || "phone-ip"}:
                      {form.phonePort || "8080"}
                      {form.phonePath.startsWith("/")
                        ? form.phonePath
                        : `/${form.phonePath || "video"}`}
                    </Typography>
                  </>
                )}

                {form.sourceType === "http" && (
                  <LabeledInput
                    label="Stream URL"
                    required
                    placeholder="http://192.168.1.50:8080/video"
                    value={form.httpUrl}
                    onChange={(v) => setForm((f) => ({ ...f, httpUrl: v }))}
                  />
                )}

                {form.sourceType === "file" && (
                  <>
                    <Typography
                      sx={{
                        color: t.textMuted,
                        fontSize: ".72rem",
                        fontWeight: 600,
                        mb: 0.6,
                      }}
                    >
                      VIDEO FILE
                      <Box component="span" sx={{ color: "#E74C3C" }}>
                        {" "}
                        *
                      </Box>
                    </Typography>
                    <Box
                      component="input"
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleFilePicked}
                      sx={{ display: "none" }}
                    />
                    {form.fileName ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1.2,
                          px: "12px",
                          py: "9px",
                          borderRadius: "8px",
                          border: `1px solid ${t.border}`,
                          background: t.bg,
                        }}
                      >
                        <CheckCircleIcon
                          sx={{ fontSize: 17, color: GREEN, flexShrink: 0 }}
                        />
                        <Typography
                          sx={{
                            color: t.text,
                            fontSize: ".85rem",
                            flex: 1,
                            minWidth: 0,
                          }}
                          noWrap
                        >
                          {/* the stored path is prefixed with a timestamp
                          purely to avoid collisions on the server — not
                          meaningful to the person, so only shown here for
                          submission, not for display */}
                          {form.fileName
                            .replace(/^.*[\\/]/, "")
                            .replace(/^\d{14}_/, "")}
                        </Typography>
                        <Box
                          onClick={() =>
                            setForm((f) => ({ ...f, fileName: "" }))
                          }
                          title="Remove and pick a different file"
                          sx={{
                            display: "flex",
                            cursor: "pointer",
                            color: t.textMuted,
                            flexShrink: 0,
                            "&:hover": { color: "#E74C3C" },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 17 }} />
                        </Box>
                      </Box>
                    ) : (
                      <Box
                        onClick={() =>
                          !uploadVideoMutation.isPending &&
                          fileInputRef.current?.click()
                        }
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 1,
                          py: 1,
                          borderRadius: "8px",
                          fontSize: ".82rem",
                          fontWeight: 600,
                          border: `1px dashed ${t.border}`,
                          color: t.textMuted,
                          cursor: uploadVideoMutation.isPending
                            ? "not-allowed"
                            : "pointer",
                          "&:hover": uploadVideoMutation.isPending
                            ? {}
                            : { borderColor: ACCENT, color: ACCENT },
                        }}
                      >
                        {uploadVideoMutation.isPending
                          ? "Uploading…"
                          : "Browse for a video file to upload"}
                      </Box>
                    )}
                    {uploadVideoMutation.isError && (
                      <Typography sx={{ color: "#E74C3C", fontSize: ".76rem" }}>
                        {uploadVideoMutation.error instanceof Error
                          ? uploadVideoMutation.error.message
                          : "Upload failed — try again."}
                      </Typography>
                    )}
                  </>
                )}

                {activeMutation.isError && (
                  <Typography sx={{ color: "#E74C3C", fontSize: ".78rem" }}>
                    {editingCameraId
                      ? "Couldn't save the changes — check the details and try again."
                      : "Couldn't add the camera — check the details and try again."}
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  flexShrink: 0,
                  px: 2.5,
                  py: 1.6,
                  borderTop: `1px solid ${t.border}`,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 1.2,
                }}
              >
                <Box
                  onClick={resetAndClose}
                  sx={{
                    px: 2,
                    py: 0.9,
                    borderRadius: "8px",
                    fontSize: ".82rem",
                    fontWeight: 600,
                    color: t.textMuted,
                    cursor: "pointer",
                    border: `1px solid ${t.border}`,
                  }}
                >
                  Cancel
                </Box>
                <Box
                  onClick={() =>
                    canSubmit && !activeMutation.isPending && handleAddCamera()
                  }
                  sx={{
                    px: 2.4,
                    py: 0.9,
                    borderRadius: "8px",
                    fontSize: ".82rem",
                    fontWeight: 600,
                    color: canSubmit ? "#fff" : t.textMuted,
                    background: canSubmit ? ACCENT : t.border,
                    cursor:
                      canSubmit && !activeMutation.isPending
                        ? "pointer"
                        : "not-allowed",
                    opacity: !canSubmit
                      ? 0.5
                      : activeMutation.isPending
                        ? 0.7
                        : 1,
                    transition: "opacity .15s, background .15s, color .15s",
                  }}
                >
                  {activeMutation.isPending
                    ? editingCameraId
                      ? "Saving…"
                      : "Connecting…"
                    : editingCameraId
                      ? "Save Changes"
                      : "Add Camera"}
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Delete camera confirmation */}
        {deleteTarget && (
          <Box
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteTarget(null);
            }}
            sx={{
              position: "fixed",
              inset: 0,
              zIndex: 210,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              sx={{
                width: "min(400px, 90vw)",
                borderRadius: "16px",
                background: t.bgSecondary,
                border: `1px solid ${t.border}`,
                boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
                p: 3,
              }}
            >
              <Typography
                sx={{
                  color: t.text,
                  fontWeight: 600,
                  fontSize: ".95rem",
                  mb: 1,
                }}
              >
                Delete camera?
              </Typography>
              <Typography
                sx={{
                  color: t.textMuted,
                  fontSize: ".82rem",
                  lineHeight: 1.5,
                  mb: 2.5,
                }}
              >
                This will permanently remove "{deleteTarget.name}" and stop its
                stream. This can't be undone.
              </Typography>
              {deleteCameraMutation.isError && (
                <Typography
                  sx={{ color: "#E74C3C", fontSize: ".78rem", mb: 1.5 }}
                >
                  Couldn't delete the camera — try again.
                </Typography>
              )}
              <Box
                sx={{ display: "flex", justifyContent: "flex-end", gap: 1.2 }}
              >
                <Box
                  onClick={() => setDeleteTarget(null)}
                  sx={{
                    px: 2,
                    py: 0.9,
                    borderRadius: "8px",
                    fontSize: ".82rem",
                    fontWeight: 600,
                    color: t.textMuted,
                    cursor: "pointer",
                    border: `1px solid ${t.border}`,
                  }}
                >
                  Cancel
                </Box>
                <Box
                  onClick={() => {
                    if (deleteCameraMutation.isPending || !deleteTarget) return;
                    deleteCameraMutation.mutate(deleteTarget.id, {
                      onSuccess: () => setDeleteTarget(null),
                    });
                  }}
                  sx={{
                    px: 2.4,
                    py: 0.9,
                    borderRadius: "8px",
                    fontSize: ".82rem",
                    fontWeight: 600,
                    color: "#fff",
                    background: "#E74C3C",
                    cursor: deleteCameraMutation.isPending
                      ? "not-allowed"
                      : "pointer",
                    opacity: deleteCameraMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {deleteCameraMutation.isPending ? "Deleting…" : "Delete"}
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Camera grid */}
        {cameras.length === 0 ? (
          <Box
            sx={{
              p: 6,
              textAlign: "center",
              borderRadius: "14px",
              background: t.surface,
              border: `1px solid ${t.border}`,
            }}
          >
            <VideocamOffIcon
              sx={{ fontSize: 32, color: t.textMuted, mb: 1.5 }}
            />
            <Typography
              sx={{ color: t.text, fontSize: ".92rem", fontWeight: 600 }}
            >
              No cameras yet
            </Typography>
            <Typography sx={{ color: t.textMuted, fontSize: ".8rem", mt: 0.5 }}>
              Cameras you add will show up here
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 2.5,
            }}
          >
            {cameras.map((cam) => {
              const isOnline = cam.status === "online";
              const hasStream = !!cam.stream_url;
              return (
                <Box
                  key={cam.id}
                  sx={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    transition: "border-color .2s",
                    "&:hover": isOnline ? { borderColor: `${ACCENT}45` } : {},
                  }}
                >
                  <Box
                    sx={{
                      aspectRatio: "16/9",
                      background: t.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      overflow: "hidden",
                      "&:hover .cam-tile-overlay": { opacity: 1 },
                    }}
                  >
                    {isOnline ? (
                      <>
                        {hasStream ? (
                          <img
                            src={cam.stream_url || ""}
                            alt={cam.name}
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <VideocamIcon
                            sx={{ color: t.textMuted, fontSize: 28 }}
                          />
                        )}
                        <Box
                          sx={{
                            position: "absolute",
                            top: 8,
                            left: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.6,
                            px: 1,
                            py: 0.3,
                            borderRadius: "6px",
                            background: "rgba(0,0,0,0.55)",
                          }}
                        >
                          <Box
                            sx={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: GREEN,
                              animation: "camBlink 1.4s ease-in-out infinite",
                              "@keyframes camBlink": {
                                "0%,100%": { opacity: 1 },
                                "50%": { opacity: 0.35 },
                              },
                            }}
                          />
                          <Typography
                            sx={{
                              color: "#fff",
                              fontSize: ".6rem",
                              fontWeight: 700,
                            }}
                          >
                            {hasStream ? "LIVE" : "ONLINE"}
                          </Typography>
                        </Box>
                      </>
                    ) : (
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <VideocamOffIcon
                          sx={{ color: t.textMuted, fontSize: 24 }}
                        />
                        <Typography
                          sx={{
                            color: t.textMuted,
                            fontSize: ".68rem",
                            fontWeight: 600,
                          }}
                        >
                          Offline
                        </Typography>
                      </Box>
                    )}

                    {/* Hover overlay — edit/delete top-right, view (center
                    box icon) only when there's actually a stream to view */}
                    <Box
                      className="cam-tile-overlay"
                      sx={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        transition: "opacity .15s",
                        background: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Box
                        sx={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          display: "flex",
                          gap: 0.6,
                        }}
                      >
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(cam);
                          }}
                          title="Edit camera"
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            cursor: "pointer",
                            "&:hover": { background: ACCENT },
                          }}
                        >
                          <EditIcon sx={{ fontSize: 15 }} />
                        </Box>
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(cam);
                          }}
                          title="Delete camera"
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            cursor: "pointer",
                            "&:hover": { background: "#E74C3C" },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 15 }} />
                        </Box>
                      </Box>

                      {isOnline && (
                        <OpenInFullIcon
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCam(cam);
                          }}
                          titleAccess="View stream"
                          sx={{
                            fontSize: 26,
                            color: "#fff",
                            cursor: "pointer",
                            p: "6px",
                            borderRadius: "6px",
                            transition: "transform .2s, background .2s",
                            "&:hover": {
                              background: ACCENT,
                              transform: "scale(1.15)",
                            },
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ p: "14px 16px 16px" }}>
                    <Typography
                      sx={{
                        color: t.text,
                        fontSize: ".85rem",
                        fontWeight: 600,
                      }}
                      noWrap
                    >
                      {cam.name}
                    </Typography>
                    <Typography
                      sx={{ color: t.textMuted, fontSize: ".74rem", mt: "2px" }}
                      noWrap
                    >
                      {cam.zone_name || "No zone"} · {cam.resolution}
                      {cam.fps ? ` · ${cam.fps}fps` : ""}
                    </Typography>
                    {cam.id === 1 && lastDetection && (
                      <Typography
                        sx={{
                          color: t.textMuted,
                          fontSize: ".7rem",
                          mt: "6px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        Last detection{" "}
                        {new Date(lastDetection).toLocaleTimeString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}
