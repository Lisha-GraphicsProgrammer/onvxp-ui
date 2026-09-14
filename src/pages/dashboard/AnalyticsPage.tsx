import { useState, useMemo } from "react";
import { Box, Typography, LinearProgress, ClickAwayListener } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InsightsIcon from "@mui/icons-material/Insights";
import BarChartIcon from "@mui/icons-material/BarChart";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import PieChartIcon from "@mui/icons-material/PieChart";
import DonutLargeIcon from "@mui/icons-material/DonutLarge";
import GridOnIcon from "@mui/icons-material/GridOn";
import RadarIcon from "@mui/icons-material/Radar";
import ScatterPlotIcon from "@mui/icons-material/ScatterPlot";
import ViewQuiltIcon from "@mui/icons-material/ViewQuilt";
import SpeedIcon from "@mui/icons-material/Speed";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, Treemap, RadialBarChart, RadialBar, ComposedChart,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from "recharts";
import PageHeader from "../../components/layout/PageHeader";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useAnalytics } from "../../hooks/queries";
import { exportIncidents, fetchAnalytics } from "../../api/analytics";
import { ACCENT, GREEN, AMBER, RED, severityConfig } from "../../lib/constants";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";

function shiftRangeBack(fromDate: string, toDate: string) {
  const msRange = new Date(toDate).getTime() - new Date(fromDate).getTime();
  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo.getTime() - msRange);
  return {
    prevFromDate: prevFrom.toISOString().split("T")[0],
    prevToDate: prevTo.toISOString().split("T")[0],
  };
}

const humanizeRule = (v: string) =>
  v.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

const CHART_TYPES: { id: "bar" | "line" | "area" | "pie" | "donut" | "heatmap" | "radar" | "scatter" | "hbar" | "treemap" | "radialbar" | "composed"; label: string; icon: React.ReactNode }[] = [
  { id: "bar", label: "Bar", icon: <BarChartIcon sx={{ fontSize: 18 }} /> },
  { id: "line", label: "Line", icon: <ShowChartIcon sx={{ fontSize: 18 }} /> },
  { id: "area", label: "Area", icon: <StackedLineChartIcon sx={{ fontSize: 18 }} /> },
  { id: "composed", label: "Bar + trend", icon: <AutoGraphIcon sx={{ fontSize: 18 }} /> },
  { id: "pie", label: "Pie", icon: <PieChartIcon sx={{ fontSize: 18 }} /> },
  { id: "donut", label: "Donut", icon: <DonutLargeIcon sx={{ fontSize: 18 }} /> },
  { id: "hbar", label: "Horizontal bar", icon: <BarChartIcon sx={{ fontSize: 18, transform: "rotate(90deg)" }} /> },
  { id: "treemap", label: "Treemap", icon: <ViewQuiltIcon sx={{ fontSize: 18 }} /> },
  { id: "radialbar", label: "Radial bar", icon: <SpeedIcon sx={{ fontSize: 18 }} /> },
  { id: "heatmap", label: "Heatmap", icon: <GridOnIcon sx={{ fontSize: 18 }} /> },
  { id: "radar", label: "Radar", icon: <RadarIcon sx={{ fontSize: 18 }} /> },
  { id: "scatter", label: "Scatter", icon: <ScatterPlotIcon sx={{ fontSize: 18 }} /> },
];

export default function AnalyticsPage() {
  const { t } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [preset, setPreset] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [chartType, setChartType] = useState<"bar" | "line" | "area" | "pie" | "donut" | "heatmap" | "radar" | "scatter" | "hbar" | "treemap" | "radialbar" | "composed">("bar");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const { data: analytics, isFetching: loading } = useAnalytics(fromDate, toDate, period);
  const overTime = analytics?.overTime ?? [];
  const byRule = analytics?.byRule ?? [];
  const byHour = analytics?.byHour ?? [];
  const fpRate = analytics?.fpRate ?? [];

  const { prevFromDate, prevToDate } = useMemo(() => shiftRangeBack(fromDate, toDate), [fromDate, toDate]);
  const { data: prevAnalytics } = useQuery({
    queryKey: ["analytics-prev", prevFromDate, prevToDate],
    queryFn: () => fetchAnalytics(prevFromDate, prevToDate, "day"),
    staleTime: 60_000,
  });
  const prevTotal = (prevAnalytics?.overTime ?? []).reduce((s, d) => s + d.count, 0);

  const applyPreset = (p: "today" | "7d" | "30d" | "custom") => {
    setPreset(p);
    const today = new Date().toISOString().split("T")[0];
    if (p === "today") { setFromDate(today); setToDate(today); setPeriod("day"); }
    else if (p === "7d") { const d = new Date(); d.setDate(d.getDate() - 7); setFromDate(d.toISOString().split("T")[0]); setToDate(today); setPeriod("day"); }
    else if (p === "30d") { const d = new Date(); d.setDate(d.getDate() - 30); setFromDate(d.toISOString().split("T")[0]); setToDate(today); setPeriod("day"); }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    setShowExportMenu(false);
    try {
      const blob = await exportIncidents(format, fromDate, toDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `onvxp_report_Site_A_${fromDate}_to_${toDate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Export error", e); }
    setExporting(null);
  };

  const handlePickChartType = (id: typeof chartType) => {
    setChartType(id);
    setShowPicker(false);
    setPickerSearch("");
  };

  const totalIncidents = overTime.reduce((s, d) => s + d.count, 0);
  const uniqueRules = byRule.length;
  const days = Math.max(1, Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000));
  const avgPerDayNum = totalIncidents / days;
  const avgPerDay = avgPerDayNum.toFixed(1);
  const worstHour = byHour.reduce((a, b) => b.count > a.count ? b : a, { hour: 0, count: 0 });

  const deltaPct = prevTotal > 0 ? Math.round(((totalIncidents - prevTotal) / prevTotal) * 100) : null;
  const hasDelta = deltaPct !== null && prevTotal > 0;

  const prevAvgPerDay = prevTotal > 0 ? prevTotal / days : 0;
  const avgDeltaPct = prevAvgPerDay > 0 ? Math.round(((avgPerDayNum - prevAvgPerDay) / prevAvgPerDay) * 100) : null;
  const hasAvgDelta = avgDeltaPct !== null && prevAvgPerDay > 0;

  const topRule = byRule.length > 0 ? [...byRule].sort((a, b) => b.count - a.count)[0] : null;
  const topRulePct = topRule && totalIncidents > 0 ? Math.round((topRule.count / totalIncidents) * 100) : 0;
  const avgPerHour = totalIncidents / 24;
  const worstHourFactor = avgPerHour > 0 && worstHour.count > 0 ? (worstHour.count / avgPerHour) : 0;
  const showInsight = totalIncidents > 0 && topRule && worstHour.count > 0;

  const sparkPoints = overTime.slice(-8);
  const sparkMax = Math.max(1, ...sparkPoints.map(d => d.count));

  const hourMap = new Map(byHour.map(h => [h.hour, h.count]));
  const fullHours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourMap.get(h) ?? 0 }));
  const maxHourCount = Math.max(1, ...fullHours.map(h => h.count));

  const topHours = [...byHour].sort((a, b) => b.count - a.count).slice(0, 3);
  const topHoursMax = Math.max(1, ...topHours.map(h => h.count));

  const DONUT_COLORS = [ACCENT, AMBER, GREEN, ACCENT, t.textMuted];
  const sortedRules = [...byRule].sort((a, b) => b.count - a.count);
  const topDonutRules = sortedRules.slice(0, 4);
  const otherCount = sortedRules.slice(4).reduce((s, r) => s + r.count, 0);
  const donutData = [...topDonutRules.map(r => ({ name: humanizeRule(r.rule_name), count: r.count })), ...(otherCount > 0 ? [{ name: "Other", count: otherCount }] : [])];
  let cumulativePct = 0;
  const donutSegments = donutData.map((d) => {
    const pct = totalIncidents > 0 ? (d.count / totalIncidents) * 100 : 0;
    const seg = { ...d, pct, dashoffset: 25 - cumulativePct };
    cumulativePct += pct;
    return seg;
  });

  const severityTotals = byRule.reduce((acc, r) => {
    const key = (r.severity || "unknown").toLowerCase();
    acc[key] = (acc[key] || 0) + r.count;
    return acc;
  }, {} as Record<string, number>);
  const severityEntries = Object.entries(severityTotals).sort((a, b) => b[1] - a[1]);

  const totalTP = fpRate.reduce((s, r) => s + r.tp_count, 0);
  const totalFP = fpRate.reduce((s, r) => s + r.fp_count, 0);
  const overallTotal = totalTP + totalFP;
  const overallFpRate = overallTotal > 0 ? Math.round((totalFP / overallTotal) * 100) : 0;
  const confidenceLabel = (total: number) => total >= 50 ? "High confidence" : total >= 15 ? "Building confidence" : "Early data";
  const reviewCoveragePct = totalIncidents > 0 ? Math.round((overallTotal / totalIncidents) * 100) : 0;

  const overTimeWithAvg = overTime.map((d, i) => {
    const window = overTime.slice(Math.max(0, i - 2), i + 1);
    const avg = window.reduce((s, x) => s + x.count, 0) / window.length;
    return { ...d, avg: Math.round(avg * 10) / 10 };
  });

  const CustomTooltipStyle = {
    background: t.bgSecondary || t.sidebarBg,
    border: `1px solid ${t.border}`,
    borderRadius: "10px",
    padding: "10px 14px",
    color: t.text,
    fontSize: "0.8rem",
  };

  const gridColor = t.border;
  const textColor = t.textMuted;
  const isEmpty = totalIncidents === 0;

  const filteredPickerTypes = CHART_TYPES.filter(c => c.label.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <PageHeader title="Analytics" description="Historical safety monitoring insights" />

      <Box sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            {(["today", "7d", "30d", "custom"] as const).map((p) => (
              <Box
                key={p}
                onClick={() => applyPreset(p)}
                sx={{ px: 2, py: 0.8, borderRadius: "8px", background: preset === p ? `${ACCENT}18` : t.surface, border: `1px solid ${preset === p ? ACCENT + "50" : t.border}`, cursor: "pointer", transition: "all .15s" }}
              >
                <Typography sx={{ color: preset === p ? ACCENT : t.textMuted, fontSize: ".78rem", fontWeight: preset === p ? 700 : 400 }}>
                  {p === "today" ? "Today" : p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : "Custom"}
                </Typography>
              </Box>
            ))}
          </Box>
          {preset === "custom" && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ background: "transparent", border: `1px solid ${t.border}`, borderRadius: "8px", color: t.text, padding: "6px 10px", fontSize: "0.82rem", outline: "none" }} />
              <Typography sx={{ color: t.textMuted, fontSize: ".82rem" }}>to</Typography>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ background: "transparent", border: `1px solid ${t.border}`, borderRadius: "8px", color: t.text, padding: "6px 10px", fontSize: "0.82rem", outline: "none" }} />
            </Box>
          )}
          <Box sx={{ display: "flex", gap: 1, ml: "auto", alignItems: "center" }}>
            {(["day", "week", "month"] as const).map(p => (
              <Box
                key={p}
                onClick={() => setPeriod(p)}
                sx={{ px: 1.5, py: 0.6, borderRadius: "7px", background: period === p ? `${ACCENT}15` : "transparent", border: `1px solid ${period === p ? ACCENT + "40" : t.border}`, cursor: "pointer" }}
              >
                <Typography sx={{ color: period === p ? ACCENT : t.textMuted, fontSize: ".72rem", fontWeight: period === p ? 700 : 400 }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Typography>
              </Box>
            ))}
            {isAdmin && (
              <Box sx={{ position: "relative" }}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!!exporting}
                  startIcon={<FileDownloadIcon sx={{ fontSize: 15 }} />}
                  onClick={() => setShowExportMenu(o => !o)}
                >
                  {exporting ? `Generating ${exporting.toUpperCase()}...` : "Export"}
                </Button>
                {showExportMenu && (
                  <Box sx={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "12px", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100, minWidth: 140 }}>
                    {[{ label: "Download CSV", format: "csv" as const }, { label: "Download PDF", format: "pdf" as const }].map(opt => (
                      <Box key={opt.format} onClick={() => handleExport(opt.format)} sx={{ px: 2, py: 1.5, cursor: "pointer", "&:hover": { background: t.surfaceHover }, display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography sx={{ color: t.text, fontSize: ".82rem" }}>{opt.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>

        {loading && <Loader sx={{ mb: 3 }} />}

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.5, mb: 2 }}>
          <Box sx={{ p: "10px 14px", borderRadius: "12px", background: `${ACCENT}10`, border: `1px solid ${ACCENT}30` }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Typography sx={{ fontSize: ".66rem", color: t.textMuted }}>Total Incidents</Typography>
              {hasDelta && (
                <Box sx={{ display: "flex", alignItems: "center", gap: "2px", px: "6px", py: "1px", borderRadius: "999px", background: deltaPct! <= 0 ? `${GREEN}20` : `${RED}20` }}>
                  {deltaPct! <= 0 ? <TrendingDownIcon sx={{ fontSize: 11, color: GREEN }} /> : <TrendingUpIcon sx={{ fontSize: 11, color: RED }} />}
                  <Typography sx={{ fontSize: ".6rem", fontWeight: 700, color: deltaPct! <= 0 ? GREEN : RED }}>{deltaPct! > 0 ? "+" : ""}{deltaPct}%</Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: t.text, mt: "2px", mb: "5px", fontVariantNumeric: "tabular-nums" }}>{totalIncidents}</Typography>
            {sparkPoints.length > 1 && (
              <svg width="100%" height="18" viewBox="0 0 120 18" preserveAspectRatio="none">
                {sparkPoints.map((d, i) => {
                  const w = 120 / sparkPoints.length - 4;
                  const x = i * (120 / sparkPoints.length);
                  const h = Math.max(2, (d.count / sparkMax) * 16);
                  const isPeak = d.count === sparkMax && d.count > 0;
                  return <rect key={i} x={x} y={18 - h} width={w} height={h} rx={1.5} fill={isPeak ? RED : ACCENT} fillOpacity={isPeak ? 1 : 0.25} />;
                })}
              </svg>
            )}
          </Box>

          <Box sx={{ p: "10px 14px", borderRadius: "12px", background: t.surface, border: `1px solid ${t.border}` }}>
            <Typography sx={{ fontSize: ".66rem", color: t.textMuted }}>Unique Rules Triggered</Typography>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: t.text, mt: "2px", fontVariantNumeric: "tabular-nums" }}>{uniqueRules}</Typography>
            <Typography sx={{ fontSize: ".64rem", color: t.textMuted, mt: "3px" }}>Distinct violation types</Typography>
          </Box>

          <Box sx={{ p: "10px 14px", borderRadius: "12px", background: t.surface, border: `1px solid ${t.border}` }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Typography sx={{ fontSize: ".66rem", color: t.textMuted }}>Avg per Day</Typography>
              {hasAvgDelta && (
                <Box sx={{ display: "flex", alignItems: "center", gap: "2px", px: "6px", py: "1px", borderRadius: "999px", background: avgDeltaPct! <= 0 ? `${GREEN}20` : `${RED}20` }}>
                  {avgDeltaPct! <= 0 ? <TrendingDownIcon sx={{ fontSize: 11, color: GREEN }} /> : <TrendingUpIcon sx={{ fontSize: 11, color: RED }} />}
                  <Typography sx={{ fontSize: ".6rem", fontWeight: 700, color: avgDeltaPct! <= 0 ? GREEN : RED }}>{avgDeltaPct! > 0 ? "+" : ""}{avgDeltaPct}%</Typography>
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: t.text, mt: "2px", fontVariantNumeric: "tabular-nums" }}>{avgPerDay}</Typography>
            <Typography sx={{ fontSize: ".64rem", color: t.textMuted, mt: "3px" }}>Incidents per calendar day</Typography>
          </Box>

          <Box sx={{ p: "10px 14px", borderRadius: "12px", background: t.surface, border: `1px solid ${t.border}` }}>
            <Typography sx={{ fontSize: ".66rem", color: t.textMuted }}>Worst Hour</Typography>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 700, color: AMBER, mt: "2px", fontVariantNumeric: "tabular-nums" }}>{worstHour.hour}:00</Typography>
            <Typography sx={{ fontSize: ".64rem", color: t.textMuted, mt: "3px" }}>{worstHour.count} incidents</Typography>
          </Box>
        </Box>

        {showInsight && (
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: "9px 14px", borderRadius: "10px", background: `${ACCENT}08`, border: `1px solid ${ACCENT}22`, mb: 2 }}>
            <InsightsIcon sx={{ fontSize: 15, color: ACCENT, mt: "1px", flexShrink: 0 }} />
            <Typography sx={{ color: t.textSecondary, fontSize: ".76rem", lineHeight: 1.4 }}>
              <Box component="span" sx={{ color: t.text, fontWeight: 700 }}>{worstHour.hour}:00</Box> is the peak hour
              {worstHourFactor > 1.2 && (
                <> — about <Box component="span" sx={{ color: AMBER, fontWeight: 700 }}>{worstHourFactor.toFixed(1)}×</Box> the hourly average</>
              )}
              {topRule && (
                <>, and <Box component="span" sx={{ color: t.text, fontWeight: 700 }}>"{humanizeRule(topRule.rule_name)}"</Box> accounts for <Box component="span" sx={{ color: ACCENT, fontWeight: 700 }}>{topRulePct}%</Box> of all triggers this period.</>
              )}
            </Typography>
          </Box>
        )}

        {isEmpty && !loading ? (
          <Box sx={{ textAlign: "center", py: 10, background: t.surface, borderRadius: "16px", border: `1px solid ${t.border}` }}>
            <TrendingUpIcon sx={{ fontSize: 48, color: t.textMuted, opacity: 0.3, mb: 2 }} />
            <Typography sx={{ color: t.textMuted, fontSize: "1rem", fontWeight: 600 }}>No incidents in selected range</Typography>
            <Typography sx={{ color: t.textMuted, fontSize: ".82rem", mt: 0.5 }}>Try selecting a wider date range or check that the pipeline has been running</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
              <Box sx={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "16px" }}>
                <Box sx={{ px: 2.5, py: 1.4, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography sx={{ color: t.text, fontWeight: 700, fontSize: ".92rem" }}>Incidents Over Time</Typography>
                    <Typography sx={{ color: t.textMuted, fontSize: ".72rem", mt: 0.2 }}>Violation volume by {period}</Typography>
                  </Box>
                  <ClickAwayListener onClickAway={() => setShowPicker(false)}>
                    <Box sx={{ position: "relative" }}>
                      <Box sx={{ display: "flex", gap: "3px", background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "8px", p: "3px" }}>
                        {(["bar", "line", "area"] as const).map((ct) => (
                          <Box key={ct} onClick={() => setChartType(ct)} sx={{ width: 30, height: 26, borderRadius: "5px", background: chartType === ct ? ACCENT : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: chartType === ct ? "#fff" : t.textMuted }}>
                            {ct === "bar" ? <BarChartIcon sx={{ fontSize: 16 }} /> : ct === "line" ? <ShowChartIcon sx={{ fontSize: 16 }} /> : <StackedLineChartIcon sx={{ fontSize: 16 }} />}
                          </Box>
                        ))}
                        <Box onClick={() => setShowPicker(o => !o)} sx={{ width: 30, height: 26, borderRadius: "5px", background: showPicker ? t.surfaceHover : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.textMuted }}>
                          <MoreHorizIcon sx={{ fontSize: 16 }} />
                        </Box>
                      </Box>

                      {showPicker && (
                        <>
                          <Box
                            onClick={() => setShowPicker(false)}
                            sx={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(0,0,0,0.45)" }}
                          />
                          <Box sx={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 440, background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: "14px", boxShadow: "0 12px 32px rgba(0,0,0,0.4)", zIndex: 50, p: 2.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                              <Typography sx={{ fontSize: ".85rem", fontWeight: 700, color: t.text }}>Choose a chart type</Typography>
                              <CloseIcon onClick={() => setShowPicker(false)} sx={{ fontSize: 16, color: t.textMuted, cursor: "pointer" }} />
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: "10px", py: "7px", borderRadius: "8px", background: t.surface, border: `1px solid ${t.border}`, mb: 1.5 }}>
                              <SearchIcon sx={{ fontSize: 15, color: t.textMuted }} />
                              <input
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                placeholder="Search chart types"
                                style={{ background: "transparent", border: "none", outline: "none", color: t.text, fontSize: "0.78rem", width: "100%" }}
                              />
                            </Box>
                            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.2, maxHeight: 340, overflowY: "auto", pr: "2px" }}>
                              {filteredPickerTypes.map((c) => (
                                <Box
                                  key={c.id}
                                  onClick={() => handlePickChartType(c.id)}
                                  sx={{
                                    border: `1px solid ${chartType === c.id ? ACCENT : t.border}`,
                                    background: chartType === c.id ? `${ACCENT}12` : "transparent",
                                    borderRadius: "9px", p: "12px 8px", textAlign: "center",
                                    cursor: "pointer",
                                    minHeight: 72,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Box sx={{ color: chartType === c.id ? ACCENT : t.textMuted, display: "flex", justifyContent: "center" }}>{c.icon}</Box>
                                  <Typography sx={{ fontSize: ".7rem", color: chartType === c.id ? t.text : t.textMuted, mt: "6px", lineHeight: 1.25 }}>{c.label}</Typography>
                                </Box>
                              ))}
                              {filteredPickerTypes.length === 0 && (
                                <Typography sx={{ gridColumn: "1 / -1", fontSize: ".76rem", color: t.textMuted, textAlign: "center", py: 2 }}>No matching chart type</Typography>
                              )}
                            </Box>
                          </Box>
                        </>
                      )}
                    </Box>
                  </ClickAwayListener>
                </Box>
                <Box sx={{ p: 2.2 }}>
                  {(["bar", "line", "area", "heatmap", "composed"].includes(chartType) && overTime.every(d => d.count === 0)) ||
                  (["pie", "donut", "radar", "hbar", "treemap"].includes(chartType) && byRule.length === 0) ||
                  (["scatter", "radialbar"].includes(chartType) && byHour.every(h => h.count === 0) && fpRate.length === 0) ? (
                    <Box sx={{ textAlign: "center", py: 4 }}><Typography sx={{ color: t.textMuted, fontSize: ".82rem" }}>No data in range</Typography></Box>
                  ) : (
                    <>
                      {(chartType === "pie" || chartType === "donut" || chartType === "radar" || chartType === "hbar" || chartType === "treemap") && (
                        <Typography sx={{ fontSize: ".68rem", color: t.textMuted, mb: 1, fontStyle: "italic" }}>
                          Shown by rule — a 30-day {chartType === "pie" || chartType === "donut" ? "pie" : "chart"} of daily counts would be unreadable
                        </Typography>
                      )}
                      {chartType === "scatter" && (
                        <Typography sx={{ fontSize: ".68rem", color: t.textMuted, mb: 1, fontStyle: "italic" }}>Shown by hour of day — a daily count series has no second variable to plot</Typography>
                      )}
                      {chartType === "radialbar" && (
                        <Typography sx={{ fontSize: ".68rem", color: t.textMuted, mb: 1, fontStyle: "italic" }}>Shown by rule — false positive rate, since a time series has no ratio to plot</Typography>
                      )}
                      {chartType === "composed" && (
                        <Typography sx={{ fontSize: ".68rem", color: t.textMuted, mb: 1, fontStyle: "italic" }}>Bars are the daily count; the line is a real 3-day rolling average</Typography>
                      )}
                      <ResponsiveContainer width="100%" height={["pie", "donut", "radar", "scatter", "hbar", "treemap", "radialbar"].includes(chartType) ? 150 : 165}>
                        {chartType === "bar" ? (
                          <BarChart data={overTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} tickFormatter={v => v.length > 7 ? v.slice(5) : v} />
                            <YAxis tick={{ fill: textColor, fontSize: 10 }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                              {overTime.map((entry, i) => <Cell key={i} fill={entry.count === Math.max(...overTime.map(d => d.count)) && entry.count > 0 ? RED : ACCENT} fillOpacity={0.85} />)}
                            </Bar>
                          </BarChart>
                        ) : chartType === "line" ? (
                          <LineChart data={overTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} tickFormatter={v => v.length > 7 ? v.slice(5) : v} />
                            <YAxis tick={{ fill: textColor, fontSize: 10 }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Line type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} dot={{ fill: ACCENT, r: 3 }} activeDot={{ r: 5 }} />
                          </LineChart>
                        ) : chartType === "area" ? (
                          <AreaChart data={overTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                              <linearGradient id="incidentsOverTimeFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} tickFormatter={v => v.length > 7 ? v.slice(5) : v} />
                            <YAxis tick={{ fill: textColor, fontSize: 10 }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Area type="monotone" dataKey="count" stroke={ACCENT} strokeWidth={2} fill="url(#incidentsOverTimeFill)" dot={{ fill: ACCENT, r: 3 }} activeDot={{ r: 5 }} />
                          </AreaChart>
                        ) : chartType === "composed" ? (
                          <ComposedChart data={overTimeWithAvg} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} tickFormatter={v => v.length > 7 ? v.slice(5) : v} />
                            <YAxis tick={{ fill: textColor, fontSize: 10 }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]} fill={ACCENT} fillOpacity={0.5} />
                            <Line type="monotone" dataKey="avg" stroke={AMBER} strokeWidth={2} dot={false} />
                          </ComposedChart>
                        ) : (chartType === "pie" || chartType === "donut") ? (
                          <PieChart>
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Pie
                              data={byRule.map(r => ({ name: humanizeRule(r.rule_name), value: r.count }))}
                              dataKey="value" nameKey="name" cx="50%" cy="50%"
                              innerRadius={chartType === "donut" ? 45 : 0} outerRadius={75}
                              label={(e: any) => e.name}
                            >
                              {byRule.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                            </Pie>
                          </PieChart>
                        ) : chartType === "hbar" ? (
                          <BarChart layout="vertical" data={[...byRule].sort((a, b) => b.count - a.count).map(r => ({ rule: humanizeRule(r.rule_name), count: r.count }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                            <XAxis type="number" tick={{ fill: textColor, fontSize: 10 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="rule" tick={{ fill: textColor, fontSize: 9 }} width={90} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                              {byRule.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        ) : chartType === "treemap" ? (
                          <Treemap data={byRule.map((r, i) => ({ name: humanizeRule(r.rule_name), size: r.count, fill: DONUT_COLORS[i % DONUT_COLORS.length] }))} dataKey="size" stroke={t.bgSecondary} fill={ACCENT}>
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                          </Treemap>
                        ) : chartType === "radialbar" ? (
                          <RadialBarChart innerRadius="25%" outerRadius="100%" data={fpRate.map((r, i) => ({ name: humanizeRule(r.rule_name), value: r.rate, fill: DONUT_COLORS[i % DONUT_COLORS.length] }))} startAngle={90} endAngle={-270}>
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <RadialBar dataKey="value" background={{ fill: t.border }} />
                          </RadialBarChart>
                        ) : chartType === "radar" ? (
                          <RadarChart data={byRule.map(r => ({ rule: humanizeRule(r.rule_name), count: r.count }))}>
                            <PolarGrid stroke={gridColor} />
                            <PolarAngleAxis dataKey="rule" tick={{ fill: textColor, fontSize: 9 }} />
                            <PolarRadiusAxis tick={{ fill: textColor, fontSize: 9 }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Radar dataKey="count" stroke={ACCENT} fill={ACCENT} fillOpacity={0.35} />
                          </RadarChart>
                        ) : chartType === "scatter" ? (
                          <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis type="number" dataKey="hour" name="Hour" tick={{ fill: textColor, fontSize: 10 }} tickFormatter={v => `${v}h`} domain={[0, 23]} />
                            <YAxis type="number" dataKey="count" name="Incidents" tick={{ fill: textColor, fontSize: 10 }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
                            <Scatter data={byHour} fill={ACCENT} />
                          </ScatterChart>
                        ) : (
                          <BarChart data={overTime} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} tickFormatter={v => v.length > 7 ? v.slice(5) : v} />
                            <YAxis tick={{ fill: textColor, fontSize: 10 }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                              {overTime.map((entry, i) => <Cell key={i} fill={entry.count === Math.max(...overTime.map(d => d.count)) && entry.count > 0 ? RED : ACCENT} fillOpacity={0.85} />)}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                      {chartType === "heatmap" && (
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${overTime.length}, 1fr)`, gap: "2px" }}>
                            {overTime.map((d, i) => {
                              const maxC = Math.max(1, ...overTime.map(x => x.count));
                              const isPeak = d.count === maxC && d.count > 0;
                              const intensity = d.count / maxC;
                              return (
                                <Box key={i} title={`${d.date} — ${d.count} incidents`} sx={{ height: 28, borderRadius: "3px", background: isPeak ? RED : `${ACCENT}${Math.round(8 + intensity * 60).toString(16).padStart(2, "0")}` }} />
                              );
                            })}
                          </Box>
                          <Typography sx={{ fontSize: ".68rem", color: t.textMuted, mt: 1, fontStyle: "italic" }}>Shown by day — each cell is one day in the selected range</Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              </Box>

              <Box sx={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "hidden" }}>
                <Box sx={{ px: 2.5, py: 1.4, borderBottom: `1px solid ${t.border}` }}>
                  <Typography sx={{ color: t.text, fontWeight: 700, fontSize: ".92rem" }}>Top Rules by Share</Typography>
                  <Typography sx={{ color: t.textMuted, fontSize: ".72rem", mt: 0.2 }}>Which rules drive the most triggers</Typography>
                </Box>
                <Box sx={{ p: 2.2 }}>
                  {donutData.length === 0 ? (
                    <Box sx={{ textAlign: "center" }}><Typography sx={{ color: t.textMuted, fontSize: ".82rem" }}>No data in range</Typography></Box>
                  ) : (
                    <>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2.2, width: "100%" }}>
                        <svg width="88" height="88" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke={t.border} strokeWidth="4" />
                          {donutSegments.map((seg, i) => (
                            <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="4" strokeDasharray={`${seg.pct} 100`} strokeDashoffset={seg.dashoffset} strokeLinecap="round" />
                          ))}
                          <text x="18" y="16.5" textAnchor="middle" fill={t.text} style={{ fontSize: "7px", fontWeight: 700 }}>{totalIncidents}</text>
                          <text x="18" y="22.5" textAnchor="middle" fill={t.textMuted} style={{ fontSize: "4px" }}>total</text>
                        </svg>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, minWidth: 0 }}>
                          {donutSegments.map((seg, i) => (
                            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: "2px", background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                              <Typography sx={{ fontSize: ".72rem", color: t.textSecondary }} noWrap>{seg.name}, {seg.count}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>

                      {severityEntries.length > 0 && (
                        <Box sx={{ mt: 1.2, pt: 1.2, borderTop: `1px solid ${t.border}` }}>
                          <Typography sx={{ fontSize: ".62rem", fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: ".05em", mb: 0.6 }}>By severity</Typography>
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6 }}>
                            {severityEntries.map(([sev, count]) => {
                              const cfg = severityConfig[sev] || { color: t.textMuted, bg: t.surface, border: t.border };
                              const pct = totalIncidents > 0 ? Math.round((count / totalIncidents) * 100) : 0;
                              return (
                                <Box key={sev} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  <Typography sx={{ fontSize: ".68rem", color: cfg.color, fontWeight: 700, width: 58, textTransform: "capitalize", flexShrink: 0 }}>{sev}</Typography>
                                  <Box sx={{ flex: 1, height: 5, borderRadius: 3, background: t.border, overflow: "hidden" }}>
                                    <Box sx={{ height: "100%", width: `${pct}%`, background: cfg.color, borderRadius: 3 }} />
                                  </Box>
                                  <Typography sx={{ fontSize: ".68rem", color: t.text, width: 30, textAlign: "right", flexShrink: 0 }}>{count}</Typography>
                                  <Typography sx={{ fontSize: ".62rem", color: t.textMuted, width: 28, textAlign: "right", flexShrink: 0 }}>{pct}%</Typography>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
              <Box sx={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "16px", p: 2.2 }}>
                <Typography sx={{ color: t.text, fontWeight: 700, fontSize: ".88rem", mb: 0.2 }}>When Incidents Happen</Typography>
                <Typography sx={{ color: t.textMuted, fontSize: ".68rem", mb: 1.2 }}>Hour of day — darker means more incidents</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "repeat(2, 1fr)", gap: "3px" }}>
                  {fullHours.map((h) => {
                    const isPeak = h.count === maxHourCount && h.count > 0;
                    const intensity = h.count / maxHourCount;
                    return (
                      <Box
                        key={h.hour}
                        title={`${h.hour}:00 — ${h.count} incidents`}
                        sx={{ aspectRatio: "1", borderRadius: "3px", background: isPeak ? RED : `${ACCENT}${Math.round(8 + intensity * 60).toString(16).padStart(2, "0")}` }}
                      />
                    );
                  })}
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.6 }}>
                  <Typography sx={{ fontSize: ".58rem", color: t.textMuted }}>0h</Typography>
                  <Typography sx={{ fontSize: ".58rem", color: t.textMuted }}>6h</Typography>
                  <Typography sx={{ fontSize: ".58rem", color: t.textMuted }}>12h</Typography>
                  <Typography sx={{ fontSize: ".58rem", color: t.textMuted }}>18h</Typography>
                  <Typography sx={{ fontSize: ".58rem", color: t.textMuted }}>23h</Typography>
                </Box>
              </Box>

              <Box sx={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "16px", overflow: "hidden" }}>
                <Box sx={{ px: 2.5, py: 1.4, borderBottom: `1px solid ${t.border}` }}>
                  <Typography sx={{ color: t.text, fontWeight: 700, fontSize: ".88rem" }}>Top Hours by Volume</Typography>
                  <Typography sx={{ color: t.textMuted, fontSize: ".68rem", mt: 0.2 }}>Busiest clock hours this period</Typography>
                </Box>
                <Box sx={{ p: 2.2, display: "flex", flexDirection: "column", gap: 1, justifyContent: "center", minHeight: 118 }}>
                  {topHours.length === 0 ? (
                    <Box sx={{ textAlign: "center", py: 2 }}><Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>No data in range</Typography></Box>
                  ) : topHours.map((h, i) => (
                    <Box key={h.hour} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 28, height: 18, borderRadius: "5px", background: i === 0 ? `${RED}20` : `${AMBER}20`, color: i === 0 ? RED : AMBER, fontSize: ".62rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {h.hour}h
                      </Box>
                      <Box sx={{ flex: 1, height: 6, borderRadius: "4px", background: t.border, overflow: "hidden" }}>
                        <Box sx={{ height: "100%", width: `${(h.count / topHoursMax) * 100}%`, background: i === 0 ? RED : AMBER, borderRadius: "4px" }} />
                      </Box>
                      <Typography sx={{ fontSize: ".72rem", color: t.text, width: 26, textAlign: "right" }}>{h.count}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>

            <Box sx={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: "16px", p: 2.2 }}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1.6 }}>
                <Box>
                  <Typography sx={{ color: t.text, fontWeight: 700, fontSize: ".88rem", mb: 0.2 }}>Rule Reliability</Typography>
                  <Typography sx={{ color: t.textMuted, fontSize: ".68rem" }}>Lower is better — false positive rate per rule</Typography>
                </Box>
                {overallTotal > 0 && (
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography sx={{ fontSize: ".85rem", fontWeight: 700, color: overallFpRate > 20 ? AMBER : GREEN, fontVariantNumeric: "tabular-nums" }}>{overallFpRate}%</Typography>
                      <Typography sx={{ fontSize: ".58rem", color: t.textMuted }}>false positive rate</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0, borderLeft: `1px solid ${t.border}`, pl: 2 }}>
                      <Typography sx={{ fontSize: ".85rem", fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>{reviewCoveragePct}%</Typography>
                      <Typography sx={{ fontSize: ".58rem", color: t.textMuted }}>reviewed, {overallTotal} of {totalIncidents}</Typography>
                    </Box>
                  </Box>
                )}
              </Box>
              {fpRate.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 2 }}><Typography sx={{ color: t.textMuted, fontSize: ".78rem" }}>No reviewed incidents yet</Typography></Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.3 }}>
                  {fpRate.map((row, i) => {
                    const healthyPct = Math.max(2, 100 - row.rate);
                    const barColor = row.rate > 50 ? RED : row.rate > 20 ? AMBER : GREEN;
                    return (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box sx={{ width: 160, flexShrink: 0 }}>
                          <Typography sx={{ fontSize: ".78rem", color: t.text, fontWeight: 600 }} noWrap>{humanizeRule(row.rule_name)}</Typography>
                          <Typography sx={{ fontSize: ".62rem", color: t.textMuted, mt: "1px" }}>{confidenceLabel(row.total)}</Typography>
                        </Box>
                        <Box sx={{ flex: 1, height: 8, borderRadius: "5px", background: t.border, overflow: "hidden" }}>
                          <Box sx={{ height: "100%", width: `${healthyPct}%`, background: barColor, borderRadius: "5px", transition: "width .3s" }} />
                        </Box>
                        <Box sx={{ width: 92, flexShrink: 0, textAlign: "right" }}>
                          <Typography sx={{ fontSize: ".82rem", fontWeight: 700, color: barColor, fontVariantNumeric: "tabular-nums" }}>{row.rate}%</Typography>
                          <Typography sx={{ fontSize: ".6rem", color: t.textMuted, mt: "1px" }}>{row.tp_count} true, {row.fp_count} false</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </>
        )}
        <Box sx={{ height: 20 }} />
      </Box>
    </Box>
  );
}