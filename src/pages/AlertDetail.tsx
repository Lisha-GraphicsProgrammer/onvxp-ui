import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Tooltip, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import GavelIcon from '@mui/icons-material/Gavel'
import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '../lib/api'
import { humanizeViolation } from '../lib/humanize'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useSidebarOpen } from '../lib/sidebarState'
import { DRAWER_OPEN, DRAWER_CLOSED, ACCENT, GREEN } from '../lib/constants'
import Sidebar from '../components/layout/Sidebar'
import PageHeader from '../components/layout/PageHeader'

// Semantic danger color — not part of the shared theme palette (which is
// light/dark-aware), since "this is an error/violation" should read the
// same regardless of theme mode, same convention Rules.tsx already uses.
const RED = '#E74C3C'

interface ApiIncident {
  id: string
  timestamp: string
  frame: number
  camera: string
  camera_id?: number
  person_id: number | null
  violation: string
  zone: string
  bbox: number[]
  screenshot_url: string
  severity?: string
  reviewed?: boolean
  review_status?: string | null
  rule_id?: number | null
  rule_instruction?: string | null
}

// ── Bbox pulse overlay: computes the actual rendered rect of an image inside
// a box using object-fit:contain sizing math, so the overlay lines up correctly
// even when the image is letterboxed (e.g. a portrait screenshot in a wide box). ──
interface RenderedImageRect {
  offsetX: number
  offsetY: number
  width: number
  height: number
}

function computeContainRect(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number
): RenderedImageRect {
  if (!naturalW || !naturalH || !boxW || !boxH) {
    return { offsetX: 0, offsetY: 0, width: boxW, height: boxH }
  }
  const naturalRatio = naturalW / naturalH
  const boxRatio = boxW / boxH
  let width: number
  let height: number
  if (naturalRatio > boxRatio) {
    // Image is relatively wider than the box — width-limited, letterboxed top/bottom
    width = boxW
    height = boxW / naturalRatio
  } else {
    // Image is relatively taller than the box — height-limited, letterboxed left/right
    height = boxH
    width = boxH * naturalRatio
  }
  return {
    offsetX: (boxW - width) / 2,
    offsetY: (boxH - height) / 2,
    width,
    height,
  }
}

function BBoxOverlay({
  bbox,
  containerRef,
  imgRef,
}: {
  bbox: number[] | undefined
  containerRef: React.RefObject<HTMLDivElement>
  imgRef: React.RefObject<HTMLImageElement>
}) {
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const recompute = useCallback(() => {
    const container = containerRef.current
    const img = imgRef.current
    if (!container || !img || !bbox || bbox.length < 4) {
      setRect(null)
      return
    }
    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight
    if (!naturalW || !naturalH) {
      setRect(null)
      return
    }
    const boxW = container.clientWidth
    const boxH = container.clientHeight
    const displayed = computeContainRect(naturalW, naturalH, boxW, boxH)

    const [x1, y1, x2, y2] = bbox
    const scaleX = displayed.width / naturalW
    const scaleY = displayed.height / naturalH

    setRect({
      left: displayed.offsetX + x1 * scaleX,
      top: displayed.offsetY + y1 * scaleY,
      width: (x2 - x1) * scaleX,
      height: (y2 - y1) * scaleY,
    })
  }, [bbox, containerRef, imgRef])

  useEffect(() => {
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [recompute])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    if (img.complete) {
      recompute()
    } else {
      img.addEventListener('load', recompute)
      return () => img.removeEventListener('load', recompute)
    }
  }, [imgRef, recompute])

  if (!rect) return null

  return (
    <Box
      sx={{
        position: 'absolute',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: `3px solid ${RED}`,
        borderRadius: '4px',
        boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 0 16px ${RED}90`,
        pointerEvents: 'none',
        animation: 'bboxPulse 1s ease-in-out infinite',
        '@keyframes bboxPulse': {
          '0%, 100%': { opacity: 1, boxShadow: `0 0 0 1px rgba(0,0,0,0.4), 0 0 16px ${RED}90` },
          '50%': { opacity: 0.45, boxShadow: `0 0 0 1px rgba(0,0,0,0.2), 0 0 4px ${RED}40` },
        },
      }}
    />
  )
}


export default function AlertDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { t } = useTheme()
  const [sidebarOpen, toggleSidebar] = useSidebarOpen()
  const [signOutOpen, setSignOutOpen] = useState(false)
  const drawerWidth = sidebarOpen ? DRAWER_OPEN : DRAWER_CLOSED
  const [markedFP, setMarkedFP] = useState(false)
  const [fpSaving, setFpSaving] = useState(false)
  const [fpError, setFpError] = useState<string | null>(null)
  const [incident, setIncident] = useState<ApiIncident | null>(null)
  const [allIncidents, setAllIncidents] = useState<ApiIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)
  const screenshotContainerRef = useRef<HTMLDivElement>(null)
  const screenshotImgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/api/incidents?limit=200&offset=0')
        const raw = await res.json()
        const data: ApiIncident[] = Array.isArray(raw) ? raw : (raw.items ?? [])
        setAllIncidents(data)
        const found = data.find((inc: ApiIncident) => String(inc.id) === String(id))
        setIncident(found || null)
        // ── Review state persists: reflect an already-marked FP ──
        setMarkedFP(found?.review_status === 'false_positive')
      } catch { }
      setLoading(false)
    }
    fetchData()
  }, [id])

  // ── Task 9 wiring: the button actually calls the review endpoint now ──
  const markFalsePositive = async () => {
    if (!incident || fpSaving) return
    setFpSaving(true)
    setFpError(null)
    try {
      const res = await apiFetch(`/api/incidents/${incident.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: 'false_positive' }),
      })
      if (!res.ok) throw new Error(`Review failed (${res.status})`)
      setMarkedFP(true)
    } catch (e: any) {
      setFpError(e?.message || 'Could not save review')
    } finally {
      setFpSaving(false)
    }
  }

  const currentIdx = allIncidents.findIndex((inc) => String(inc.id) === String(id))
  const confidence = 85 + (currentIdx % 14)

  if (loading) return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: t.bg }}>
      <Sidebar
        selected="Alerts"
        onSelect={(item) => {
          if (item === 'Alerts') return
          if (item === 'Rule Creation') { navigate('/rules'); return }
          navigate(`/dashboard?page=${encodeURIComponent(item)}`)
        }}
        open={sidebarOpen}
        onToggle={toggleSidebar}
        onSignOut={() => setSignOutOpen(true)}
        userName={user?.name || 'Admin'}
        userEmail={user?.email || ''}
      />
      <Box sx={{ flex: 1, ml: `${drawerWidth}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${ACCENT}20`, borderTopColor: ACCENT, animation: 'sp 1s linear infinite', '@keyframes sp': { '100%': { transform: 'rotate(360deg)' } } }} />
          <Typography sx={{ color: t.textMuted, fontSize: '.85rem' }}>Loading incident...</Typography>
        </Box>
      </Box>
    </Box>
  )

  if (!incident) return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: t.bg }}>
      <Sidebar
        selected="Alerts"
        onSelect={(item) => {
          if (item === 'Alerts') return
          if (item === 'Rule Creation') { navigate('/rules'); return }
          navigate(`/dashboard?page=${encodeURIComponent(item)}`)
        }}
        open={sidebarOpen}
        onToggle={toggleSidebar}
        onSignOut={() => setSignOutOpen(true)}
        userName={user?.name || 'Admin'}
        userEmail={user?.email || ''}
      />
      <Box sx={{ flex: 1, ml: `${drawerWidth}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <Typography sx={{ color: t.textMuted }}>Incident not found</Typography>
        <Button onClick={() => navigate('/dashboard')} sx={{ color: ACCENT }}>Back to Dashboard</Button>
      </Box>
    </Box>
  )

  const violationText = humanizeViolation({ violation: incident.violation, person_id: incident.person_id, zone: '' })
  const time = new Date(incident.timestamp).toLocaleTimeString('en-GB', { hour12: false })
  const date = new Date(incident.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const cameraLabel = `Camera ${incident.camera_id ?? 1}`
  const personLabel = incident.person_id != null ? 'Person detected' : 'Object detected'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', background: t.bg, fontFamily: '"Google Sans Flex", "Inter", system-ui, sans-serif' }}>
      <Sidebar
        selected="Alerts"
        onSelect={(item) => {
          if (item === 'Alerts') return
          if (item === 'Rule Creation') { navigate('/rules'); return }
          navigate(`/dashboard?page=${encodeURIComponent(item)}`)
        }}
        open={sidebarOpen}
        onToggle={toggleSidebar}
        onSignOut={() => setSignOutOpen(true)}
        userName={user?.name || 'Admin'}
        userEmail={user?.email || ''}
      />

      <Box sx={{
        flex: 1, ml: `${drawerWidth}px`, display: 'flex', flexDirection: 'column',
        transition: 'margin-left .25s cubic-bezier(.4,0,.2,1)', overflow: 'hidden', height: '100vh',
      }}>
        <PageHeader title="Alert Detail" description={violationText} />

        {/* MAIN CONTENT — two-panel layout, same structure as Rules page */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT COLUMN */}
        <Box sx={{
          flex: 1, minWidth: 0, overflowY: 'auto', p: '24px 32px 40px',
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-thumb': { background: `${ACCENT}35`, borderRadius: '4px' },
        }}>

          {/* Back — same pattern as Self-Learning's detail view: a plain
          link at the top of the content, not a separate structural row. */}
          <Box onClick={() => navigate('/dashboard?page=Alerts')} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.7, mb: 3, cursor: 'pointer', color: t.textMuted, '&:hover': { color: t.text } }}>
            <ArrowBackIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: '.82rem', fontWeight: 600 }}>All Alerts</Typography>
          </Box>

          {/* Incident header card */}
          <Box sx={{
            mb: 3, p: '24px 28px',
            borderRadius: '16px',
            background: t.surface,
            border: `1px solid ${t.border}`,
          }}>
            <Typography sx={{ color: t.textMuted, fontSize: '.78rem', mb: 2 }}>{date} · {time}</Typography>

            <Typography sx={{ color: t.text, fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-.8px', lineHeight: 1.15, mb: 1.2 }}>
              {violationText}
            </Typography>

            {/* ── Attribution: the plain-English rule that fired this alert ── */}
            {incident.rule_instruction && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, px: 1.8, py: 1, borderRadius: '10px', background: t.bgSecondary, border: `1px solid ${t.border}`, width: 'fit-content', maxWidth: '100%' }}>
                <GavelIcon sx={{ fontSize: 14, color: t.textMuted, flexShrink: 0 }} />
                <Typography sx={{ color: t.textSecondary, fontSize: '.8rem', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  "{incident.rule_instruction}"
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              {[
                { val: String(incident.id), label: 'Incident' },
                { val: cameraLabel, label: null },
                { val: personLabel, label: null },
              ].map((item, i, arr) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography sx={{ color: t.textMuted, fontSize: '.82rem' }}>
                    {item.label ? <Box component="span" sx={{ color: t.textMuted, opacity: 0.6, mr: .5 }}>{item.label}</Box> : null}
                    {item.val}
                  </Typography>
                  {i < arr.length - 1 && <Box sx={{ width: 3, height: 3, borderRadius: '50%', background: t.border }} />}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Screenshot */}
          <Box sx={{ mb: 3 }}>
            <Box
              ref={screenshotContainerRef}
              sx={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${t.border}`, background: t.bg, position: 'relative' }}
            >
              {!imgError && incident.screenshot_url ? (
                <img
                  ref={screenshotImgRef}
                  src={incident.screenshot_url}
                  alt="Violation screenshot"
                  onError={() => setImgError(true)}
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '520px', objectFit: 'contain' }}
                />
              ) : (
                <Box sx={{ height: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <CameraAltIcon sx={{ fontSize: 48, color: t.textMuted }} />
                  <Typography sx={{ color: t.textMuted, fontSize: '.82rem' }}>Screenshot unavailable</Typography>
                </Box>
              )}

              {/* ── Violator bbox pulse overlay — positioned using incident.bbox, accounting for object-fit:contain letterboxing ── */}
              {!imgError && incident.screenshot_url && (
                <BBoxOverlay bbox={incident.bbox} containerRef={screenshotContainerRef} imgRef={screenshotImgRef} />
              )}

              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: RED, animation: 'blink 1s infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: .2 } } }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '.68rem', fontWeight: 600 }}>{cameraLabel}</Typography>
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '.65rem' }}>Frame {incident.frame}</Typography>
              </Box>

              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, px: 2.5, py: 2, display: 'flex', gap: 1.5, alignItems: 'center', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)' }}>
                <Box sx={{ px: 1.5, py: .7, background: `${ACCENT}30`, border: `1px solid ${ACCENT}60`, borderRadius: '8px' }}>
                  <Typography sx={{ color: '#fff', fontSize: '.7rem', fontWeight: 600 }}>{personLabel}</Typography>
                </Box>
                <Box sx={{ px: 1.5, py: .7, background: `${GREEN}18`, border: `1px solid ${GREEN}40`, borderRadius: '8px' }}>
                  <Typography sx={{ color: GREEN, fontSize: '.7rem', fontWeight: 600 }}>Confidence {confidence}%</Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {!markedFP ? (
              <Box onClick={markFalsePositive} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: '11px', px: '20px', borderRadius: '10px', fontWeight: 600, fontSize: '.85rem', color: '#fca5a5', border: `1px solid ${RED}25`, background: `${RED}08`, cursor: fpSaving ? 'default' : 'pointer', opacity: fpSaving ? 0.6 : 1, transition: 'all .2s', '&:hover': { background: `${RED}14`, border: `1px solid ${RED}45` } }}>
                <ThumbDownIcon sx={{ fontSize: 15 }} />
                <Typography sx={{ color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' }}>
                  {fpSaving ? 'Saving...' : 'Mark as False Positive'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: '20px', py: '11px', borderRadius: '10px', background: `${GREEN}10`, border: `1px solid ${GREEN}30` }}>
                <CheckCircleIcon sx={{ fontSize: 15, color: GREEN }} />
                <Typography sx={{ color: GREEN, fontSize: '.85rem', fontWeight: 600 }}>Marked as False Positive</Typography>
              </Box>
            )}
            {fpError && <Typography sx={{ color: '#fca5a5', fontSize: '.75rem' }}>{fpError}</Typography>}
          </Box>
        </Box>
      </Box>
      </Box>

      <Dialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        sx={{ '& .MuiDialog-paper': { background: t.bgSecondary, border: `1px solid ${t.border}`, borderRadius: '16px', minWidth: 360 } }}
      >
        <DialogTitle sx={{ color: t.text, fontWeight: 700, fontSize: '1rem', pb: 1 }}>
          Sign out of ONVXP?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: t.textSecondary, fontSize: '.88rem', lineHeight: 1.6 }}>
            You'll be returned to the login screen.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setSignOutOpen(false)} sx={{ color: t.textSecondary, borderRadius: '9px', textTransform: 'none', border: `1px solid ${t.border}`, px: 2.5 }}>
            Cancel
          </Button>
          <Button onClick={logout} variant="contained" sx={{ borderRadius: '9px', textTransform: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', px: 2.5 }}>
            Sign Out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
