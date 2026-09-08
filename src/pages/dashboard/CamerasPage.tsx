import { useState } from "react";
import { Box, Typography } from "@mui/material";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import PageHeader from "../../components/layout/PageHeader";
import { useTheme } from "../../context/ThemeContext";
import { useCameras, useLatestIncident } from "../../hooks/queries";
import { ACCENT, GREEN } from "../../lib/constants";
import type { ApiCamera } from "../../types";

// A camera from the API may not yet have zone_id/zone_name in its declared
// type if types.ts hasn't been updated since the zone/camera restructure —
// accessed defensively here rather than assuming the shape.
type CameraWithZone = ApiCamera & { zone_name?: string | null };

export default function CamerasPage() {
  const { t } = useTheme();
  const [selectedCam, setSelectedCam] = useState<CameraWithZone | null>(null);

  const { data: camerasData, isError: camError } = useCameras();
  const { data: latestIncident, isError: incError } = useLatestIncident();

  const cameras: CameraWithZone[] = camerasData ?? [];
  const lastDetection: string | null = latestIncident?.timestamp ?? null;
  const apiError = camError || incError;

  const onlineCount = cameras.filter((c) => c.status === "online").length;
  const offlineCount = cameras.filter((c) => c.status === "offline").length;

  const statCards = [
    { val: String(cameras.length), label: "Total cameras", color: t.textMuted, icon: <VideocamIcon sx={{ fontSize: 19 }} /> },
    { val: String(onlineCount), label: "Online", color: GREEN, icon: <CheckCircleIcon sx={{ fontSize: 19 }} /> },
    { val: String(offlineCount), label: "Offline", color: "#E74C3C", icon: <VideocamOffIcon sx={{ fontSize: 19 }} /> },
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
        {/* Stat cards — plain, no decorative glow, matches the picker
        card treatment used elsewhere: hairline border, subtle shadow. */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, mb: 4 }}>
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
                <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: t.text, lineHeight: 1.1 }}>
                  {s.val}
                </Typography>
                <Typography sx={{ color: t.textMuted, fontSize: ".78rem", mt: "2px" }}>{s.label}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Camera expand modal */}
        {selectedCam && (
          <Box
            onClick={() => setSelectedCam(null)}
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
              onClick={(e) => e.stopPropagation()}
              sx={{
                width: "min(900px, 90vw)",
                borderRadius: "16px",
                overflow: "hidden",
                background: t.surface,
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
                  <Box sx={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT }} />
                  <Typography sx={{ color: t.text, fontWeight: 600, fontSize: ".9rem" }}>
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
                  style={{ width: "100%", display: "block", maxHeight: "70vh", objectFit: "contain", background: "#000" }}
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
                  <Typography sx={{ color: t.textMuted, fontSize: ".85rem" }}>No stream available</Typography>
                </Box>
              )}
              <Box sx={{ px: 2.5, py: 1.4, display: "flex", gap: 3 }}>
                {selectedCam.zone_name && (
                  <Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>{selectedCam.zone_name}</Typography>
                )}
                <Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>{selectedCam.fps} fps</Typography>
                <Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>{selectedCam.resolution}</Typography>
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
            <VideocamOffIcon sx={{ fontSize: 32, color: t.textMuted, mb: 1.5 }} />
            <Typography sx={{ color: t.text, fontSize: ".92rem", fontWeight: 600 }}>
              No cameras yet
            </Typography>
            <Typography sx={{ color: t.textMuted, fontSize: ".8rem", mt: 0.5 }}>
              Cameras you add will show up here
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2.5 }}>
            {cameras.map((cam) => {
              const isOnline = cam.status === "online";
              const hasStream = !!cam.stream_url;
              return (
                <Box
                  key={cam.id}
                  onClick={() => isOnline && setSelectedCam(cam)}
                  sx={{
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    cursor: isOnline ? "pointer" : "default",
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
                    }}
                  >
                    {isOnline ? (
                      <>
                        {hasStream ? (
                          <img
                            src={cam.stream_url || ""}
                            alt={cam.name}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <VideocamIcon sx={{ color: t.textMuted, fontSize: 28 }} />
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
                              "@keyframes camBlink": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.35 } },
                            }}
                          />
                          <Typography sx={{ color: "#fff", fontSize: ".6rem", fontWeight: 700 }}>
                            {hasStream ? "LIVE" : "ONLINE"}
                          </Typography>
                        </Box>
                      </>
                    ) : (
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                        <VideocamOffIcon sx={{ color: t.textMuted, fontSize: 24 }} />
                        <Typography sx={{ color: t.textMuted, fontSize: ".68rem", fontWeight: 600 }}>
                          Offline
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ p: "14px 16px 16px" }}>
                    <Typography sx={{ color: t.text, fontSize: ".85rem", fontWeight: 600 }} noWrap>
                      {cam.name}
                    </Typography>
                    <Typography sx={{ color: t.textMuted, fontSize: ".74rem", mt: "2px" }} noWrap>
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
                        Last detection {new Date(lastDetection).toLocaleTimeString()}
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