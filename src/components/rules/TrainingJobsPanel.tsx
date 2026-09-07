import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Tooltip, ClickAwayListener } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PendingIcon from "@mui/icons-material/Pending";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PageHeader from "../layout/PageHeader";
import { TableCard, TablePagination } from "../common/DataTable";
import { FilterDropdown } from "../common/Dropdown";
import { useTheme } from "../../context/ThemeContext";
import {
  fetchTrainingJobs,
  fetchTrainingJob,
  approveTrainingJob,
  rejectTrainingJob,
  TrainingJob,
} from "../../api/trainingJobs";

// ── ONVXP accent palette — matches AlertDetail / Alerts / Rules pages ──
const ACCENT = "#2B7A78";
const GREEN = "#27AE60";
const LIGHT_GREEN = "#8BC34A";
const AMBER = "#D4891A";
const CYAN = "#3498DB";
const RED = "#E74C3C";

// ── mAP50 quality scale — matches standard object-detection accuracy
// conventions: 0.90+ excellent, 0.70-0.90 good, 0.50-0.70 mediocre,
// below 0.50 poor. ──
function resultColor(score: number): string {
  if (score >= 0.9) return GREEN;
  if (score >= 0.7) return LIGHT_GREEN;
  if (score >= 0.5) return AMBER;
  return RED;
}

// Canonical pipeline order — stages the backend hasn't reached yet render as pending
const PIPELINE_STAGES = [
  { key: "queued", label: "Queued" },
  { key: "searching_data", label: "Searching datasets" },
  { key: "preparing_dataset", label: "Preparing dataset" },
  { key: "training", label: "Training model" },
  { key: "evaluating", label: "Evaluating" },
  { key: "awaiting_approval", label: "Awaiting your approval" },
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Queued", color: CYAN },
  searching_data: { label: "Searching datasets", color: CYAN },
  preparing_dataset: { label: "Preparing dataset", color: CYAN },
  training: { label: "Training", color: AMBER },
  evaluating: { label: "Evaluating", color: AMBER },
  awaiting_approval: { label: "Awaiting approval", color: AMBER },
  approved: { label: "Live", color: GREEN },
  failed: { label: "Failed", color: RED },
  cancelled: { label: "Cancelled", color: "#8a8a8a" },
};

const FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_approval", label: "Awaiting approval" },
  { value: "approved", label: "Live" },
  { value: "failed", label: "Failed" },
];

// class_name is stored snake_case (e.g. "welding_mask") — display as
// readable title case ("Welding Mask") instead of a blanket CSS capitalize
function humanizeClassName(name: string): string {
  return name
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveDisplayStatus(job: TrainingJob): string {
  const isTerminal = job.status === "approved" || job.status === "failed" || job.status === "cancelled";
  return isTerminal ? job.status : job.current_stage || job.status;
}

function StatusPill({ statusKey, size = "md" }: { statusKey: string; size?: "sm" | "md" }) {
  const meta = STATUS_META[statusKey] || { label: statusKey.replace(/_/g, " "), color: CYAN };
  const isSm = size === "sm";
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.7,
        px: isSm ? "8px" : "10px",
        py: isSm ? "3px" : "4px",
        borderRadius: "999px",
        background: `${meta.color}18`,
        border: `1px solid ${meta.color}40`,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: meta.color,
          boxShadow: `0 0 6px ${meta.color}`,
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          color: meta.color,
          fontSize: isSm ? ".64rem" : ".68rem",
          fontWeight: 700,
          letterSpacing: ".02em",
        }}
      >
        {meta.label}
      </Typography>
    </Box>
  );
}

// ============================================================
// LIST VIEW — a clean, filterable, searchable table
// ============================================================

function JobRow({ job, onOpen }: { job: TrainingJob; onOpen: (id: number) => void }) {
  const { t } = useTheme();
  const metrics = job.metrics;

  return (
    <Box
      onClick={() => onOpen(job.id)}
      sx={{
        display: "grid",
        gridTemplateColumns: "60px 1fr 60px 160px 140px 28px",
        alignItems: "center",
        gap: 2,
        px: 3,
        py: "16px",
        borderBottom: `1px solid ${t.border}`,
        cursor: "pointer",
        transition: "background .15s",
        "&:hover": { background: t.surfaceHover || `${ACCENT}05` },
      }}
    >
      <Typography sx={{ color: t.textMuted, fontSize: ".82rem" }}>
        {job.id}
      </Typography>

      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ color: t.text, fontSize: ".86rem", fontWeight: 700 }} noWrap>
          {humanizeClassName(job.class_name)}
        </Typography>
      </Box>

      {job.status === "approved" ? (
        <Tooltip title="Active">
          <CheckCircleIcon sx={{ fontSize: 19, color: GREEN }} />
        </Tooltip>
      ) : job.status === "failed" || job.status === "cancelled" ? (
        <Tooltip title="Failed">
          <CancelIcon sx={{ fontSize: 19, color: RED }} />
        </Tooltip>
      ) : (
        <Tooltip title="In progress">
          <PendingIcon
            sx={{
              fontSize: 19,
              color: AMBER,
              animation: "trainingSpin 1.6s linear infinite",
              "@keyframes trainingSpin": {
                "100%": { transform: "rotate(360deg)" },
              },
            }}
          />
        </Tooltip>
      )}

      <Box sx={{ fontSize: ".76rem", color: t.textMuted }}>
        {metrics ? (
          <span>
            mAP50 <b style={{ color: metrics.map50 != null ? resultColor(metrics.map50) : t.textSecondary }}>{metrics.map50?.toFixed(2)}</b>
          </span>
        ) : job.status === "failed" ? (
          <Tooltip title={job.error || ""}>
            <span style={{ color: RED, cursor: "help" }}>See error</span>
          </Tooltip>
        ) : (
          <span>—</span>
        )}
      </Box>

      <Box>
        <Typography sx={{ color: t.text, fontSize: ".8rem" }}>
          {new Date(job.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
        </Typography>
        <Typography sx={{ color: t.textMuted, fontSize: ".72rem", mt: "1px" }}>
          {new Date(job.updated_at).toLocaleTimeString("en-GB", { hour12: false })}
        </Typography>
      </Box>

      <ChevronRightIcon sx={{ fontSize: 18, color: t.textMuted }} />
    </Box>
  );
}


function ListView({ onOpen }: { onOpen: (id: number) => void }) {
  const { t } = useTheme();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Debounce the search box so every keystroke doesn't fire a request —
  // waits 350ms after the person stops typing.
  useEffect(() => {
    const tm = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(tm);
  }, [search]);

  // A new search term, filter, or page size invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: ["training-jobs", page, pageSize, filter, debouncedSearch],
    queryFn: () => fetchTrainingJobs({ page, pageSize, status: filter, search: debouncedSearch }),
    refetchInterval: 4000,
  });

  const jobs = data?.items || [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const hasAnyFilter = !!debouncedSearch || filter !== "all";

  return (
    <>
      <Box sx={{ display: "flex", gap: 1.2, mb: 3, flexWrap: "wrap" }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 220,
            height: 42,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            borderRadius: "10px",
            background: t.surface,
            border: `1px solid ${t.border}`,
          }}
        >
          <SearchIcon sx={{ fontSize: 16, color: t.textMuted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by model name..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: t.text,
              fontSize: ".82rem",
              padding: "10px 0",
              fontFamily: "inherit",
            }}
          />
        </Box>
        <FilterDropdown value={filter} options={FILTER_OPTIONS} onChange={setFilter} minWidth={170} align="right" />
      </Box>

      <TableCard
        columns={["ID", "Model", "Status", "Result", "Date & Time", ""]}
        gridTemplateColumns="60px 1fr 60px 160px 140px 28px"
        isLoading={isLoading}
        isEmpty={jobs.length === 0}
        emptyIcon={<ModelTrainingIcon sx={{ fontSize: 28, color: t.textMuted, mb: 1 }} />}
        emptyTitle={hasAnyFilter ? "No jobs match your search." : "No training jobs right now."}
        emptySubtitle={!hasAnyFilter ? "Ask for a rule involving something new, and it'll show up here." : undefined}
      >
        {jobs.map((j) => <JobRow key={j.id} job={j} onOpen={onOpen} />)}
      </TableCard>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </>
  );
}

// ============================================================
// DETAIL VIEW — full pipeline for one job
// ============================================================

function StageRow({
  label,
  state,
  detail,
  progressCurrent,
  progressTotal,
  isLast,
}: {
  label: string;
  state: string;
  detail?: string;
  progressCurrent?: number;
  progressTotal?: number;
  isLast: boolean;
}) {
  const { t } = useTheme();
  const iconColor =
    state === "done" ? GREEN : state === "failed" ? RED : state === "running" ? ACCENT : t.textMuted;
  const pct =
    state === "running" && progressCurrent != null && progressTotal
      ? Math.min(100, Math.round((progressCurrent / progressTotal) * 100))
      : null;

  return (
    <Box sx={{ display: "flex", gap: 1.5 }}>
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: state === "pending" ? "transparent" : `${iconColor}18`,
            border: state === "pending" ? `1.5px solid ${t.border}` : `1.5px solid ${iconColor}55`,
            flexShrink: 0,
          }}
        >
          {state === "done" && <CheckCircleIcon sx={{ fontSize: 14, color: GREEN }} />}
          {state === "failed" && <CancelIcon sx={{ fontSize: 14, color: RED }} />}
          {state === "running" && (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: ACCENT,
                boxShadow: `0 0 8px ${ACCENT}`,
                animation: "trainingPulse 1.4s ease-in-out infinite",
                "@keyframes trainingPulse": {
                  "0%, 100%": { opacity: 1, transform: "scale(1)" },
                  "50%": { opacity: 0.4, transform: "scale(0.7)" },
                },
              }}
            />
          )}
          {state === "pending" && <RadioButtonUncheckedIcon sx={{ fontSize: 12, color: t.textMuted }} />}
        </Box>
        {!isLast && (
          <Box sx={{ width: "1.5px", flex: 1, minHeight: 18, background: state === "pending" ? t.border : `${iconColor}40`, my: "2px" }} />
        )}
      </Box>

      <Box sx={{ pb: 2.2, flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
          <Typography sx={{ fontSize: ".8rem", fontWeight: state === "running" ? 700 : 500, color: state === "pending" ? t.textMuted : t.text, lineHeight: 1.3 }}>
            {label}
          </Typography>
          {pct != null && (
            <Typography sx={{ fontSize: ".72rem", fontWeight: 700, color: ACCENT, fontFamily: "monospace", flexShrink: 0 }}>
              {pct}%
            </Typography>
          )}
        </Box>
        {detail && <Typography sx={{ fontSize: ".72rem", color: t.textSecondary, mt: "2px" }}>{detail}</Typography>}
        {pct != null && (
          <Box sx={{ mt: "6px", height: 4, borderRadius: "3px", background: t.border, overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: "3px",
                background: `linear-gradient(90deg, ${ACCENT}, #E8825A)`,
                transition: "width .5s ease-out",
                boxShadow: `0 0 6px ${ACCENT}80`,
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

// Detail view reads like a document, so it stays comfortably narrow even
// on a wide screen, while the list view (below) is allowed to stretch full width
const DETAIL_MAX_WIDTH = 760;

function DetailView({ jobId, onBack }: { jobId: number; onBack: () => void }) {
  const { t } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionState, setActionState] = useState<"idle" | "working" | "done">("idle");

  const { data: job } = useQuery({
    queryKey: ["training-job", jobId],
    queryFn: () => fetchTrainingJob(jobId),
    refetchInterval: 1500,
  });

  if (!job) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography sx={{ color: t.textMuted, fontSize: ".85rem" }}>Loading job…</Typography>
      </Box>
    );
  }

  const displayStatus = resolveDisplayStatus(job);
  const isAwaitingApproval = displayStatus === "awaiting_approval";

  const stageMap: Record<string, { status: string; detail?: string; progress_current?: number; progress_total?: number }> = {};
  for (const s of job.stages || []) stageMap[s.name] = s;

  const handleApprove = async () => {
    setActionState("working");
    await approveTrainingJob(job.id);
    await queryClient.invalidateQueries({ queryKey: ["training-job", jobId] });
    await queryClient.invalidateQueries({ queryKey: ["training-jobs"] });
    setActionState("done");

    // Redirect to Rules page and show a success toast there — reuses
    // Rules.tsx's existing PENDING_TRAINING_KEY poll, which runs a check
    // immediately on mount (not just its 10s interval), so the toast
    // appears right away. This key name must exactly match Rules.tsx's
    // PENDING_TRAINING_KEY constant ("omnix_pending_training_job").
    try {
      localStorage.setItem(
        "omnix_pending_training_job",
        JSON.stringify({
          jobId: job.id,
          instruction: humanizeClassName(job.class_name),
          startedAt: Date.now(),
        }),
      );
    } catch {}

    navigate("/rules");
  };

  const handleReject = async () => {
    setActionState("working");
    await rejectTrainingJob(job.id);
    await queryClient.invalidateQueries({ queryKey: ["training-job", jobId] });
    await queryClient.invalidateQueries({ queryKey: ["training-jobs"] });
    setActionState("done");
  };

  return (
    <Box sx={{ maxWidth: DETAIL_MAX_WIDTH }}>
      <Box onClick={onBack} sx={{ display: "inline-flex", alignItems: "center", gap: 0.7, mb: 3, cursor: "pointer", color: t.textMuted, "&:hover": { color: t.text } }}>
        <ArrowBackIcon sx={{ fontSize: 15 }} />
        <Typography sx={{ fontSize: ".82rem", fontWeight: 600 }}>All training jobs</Typography>
      </Box>

      <Box sx={{ borderRadius: "16px", background: t.surface, border: `1px solid ${t.border}`, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.16)" }}>
        <Box
          sx={{
            px: 3.5,
            py: "20px",
            background: `linear-gradient(135deg, ${ACCENT}15 0%, transparent 60%)`,
            borderBottom: `1px solid ${ACCENT}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.6 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "11px",
                background: `linear-gradient(135deg, ${ACCENT}, #17252A)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 16px ${ACCENT}45`,
              }}
            >
              <ModelTrainingIcon sx={{ fontSize: 20, color: "#fff" }} />
            </Box>
            <Box>
              <Typography sx={{ color: t.text, fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-.3px" }}>
                {humanizeClassName(job.class_name)}
              </Typography>
              <Typography sx={{ color: t.textMuted, fontSize: ".72rem", mt: "1px" }}>Job #{job.id}</Typography>
            </Box>
          </Box>
          <StatusPill statusKey={displayStatus} />
        </Box>

        <Box sx={{ px: 3.5, pt: 3, pb: 1 }}>
          {PIPELINE_STAGES.map((st, i) => {
            const entry = stageMap[st.key];
            let state = "pending";
            if (job.status === "approved") state = "done";
            else if (entry) state = entry.status;
            else if (job.current_stage === st.key) state = "running";
            if (job.status === "failed" && job.current_stage === st.key) state = "failed";
            return (
              <StageRow
                key={st.key}
                label={st.label}
                state={state}
                detail={entry?.detail}
                progressCurrent={entry?.progress_current}
                progressTotal={entry?.progress_total}
                isLast={i === PIPELINE_STAGES.length - 1}
              />
            );
          })}
        </Box>

        {job.metrics && (
          <Box sx={{ mx: 3.5, mb: 3, p: "16px 18px", borderRadius: "12px", background: `${GREEN}08`, border: `1px solid ${GREEN}25`, display: "flex", gap: 3, flexWrap: "wrap" }}>
            {[
              ["Precision", job.metrics.precision],
              ["Recall", job.metrics.recall],
              ["mAP50", job.metrics.map50],
              ["mAP50-95", job.metrics.map50_95],
            ].map(([label, val]) =>
              val != null ? (
                <Box key={label as string}>
                  <Typography sx={{ fontSize: ".65rem", color: t.textMuted, textTransform: "uppercase", letterSpacing: ".06em", mb: "2px" }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color: GREEN, fontFamily: "monospace" }}>
                    {(val as number).toFixed(2)}
                  </Typography>
                </Box>
              ) : null
            )}
          </Box>
        )}

        {job.error && (
          <Box sx={{ mx: 3.5, mb: 3, px: 2.2, py: 1.4, borderRadius: "10px", background: `${RED}12`, border: `1px solid ${RED}35` }}>
            <Typography sx={{ color: RED, fontSize: ".78rem", fontWeight: 600, mb: "3px" }}>What went wrong</Typography>
            <Typography sx={{ color: t.textSecondary, fontSize: ".78rem", lineHeight: 1.55 }}>{job.error}</Typography>
          </Box>
        )}

        {isAwaitingApproval && (
          <Box sx={{ px: 3.5, pb: 3.5, display: "flex", gap: 1.2 }}>
            <Box
              onClick={actionState === "idle" ? handleApprove : undefined}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                px: "20px",
                py: "11px",
                borderRadius: "11px",
                background: `linear-gradient(135deg, ${GREEN}, #1e8449)`,
                color: "#fff",
                fontWeight: 700,
                fontSize: ".84rem",
                cursor: actionState === "idle" ? "pointer" : "default",
                opacity: actionState === "idle" ? 1 : 0.6,
                boxShadow: `0 4px 16px ${GREEN}40`,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 16 }} />
              {actionState === "working" ? "Approving…" : "Approve — make it live"}
            </Box>
            <Box
              onClick={actionState === "idle" ? handleReject : undefined}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.8,
                px: "20px",
                py: "11px",
                borderRadius: "11px",
                background: t.surface,
                border: `1px solid ${t.border}`,
                color: t.textSecondary,
                fontWeight: 700,
                fontSize: ".84rem",
                cursor: actionState === "idle" ? "pointer" : "default",
                opacity: actionState === "idle" ? 1 : 0.6,
              }}
            >
              Reject
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ============================================================
// TOP-LEVEL: switches between list and detail based on ?job=
// ============================================================

export default function TrainingJobsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const jobIdParam = searchParams.get("job");

  const openJob = (id: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("job", String(id));
    setSearchParams(next);
  };

  const closeJob = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("job");
    setSearchParams(next);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <PageHeader
        title="Self-Learning"
        description="Models ONVXP taught itself when a rule needed something new"
      />
      <Box sx={{ p: 4, width: "100%", position: "relative", zIndex: 1, boxSizing: "border-box" }}>
        {jobIdParam ? (
          <DetailView jobId={Number(jobIdParam)} onBack={closeJob} />
        ) : (
          <ListView onOpen={openJob} />
        )}
      </Box>
    </Box>
  );
}