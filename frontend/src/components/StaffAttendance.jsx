import React, { useState, useEffect, useRef } from "react";
import {
  getCurrentAttendance,
  clockIn,
  clockOut,
  getAttendanceLogs,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Clock,
  MapPin,
  Camera,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UserCheck,
  History,
  Video,
  LogOut,
  LogIn,
  Calendar,
  Activity,
  Briefcase,
} from "lucide-react";

/* ─── Design tokens — matches Staff Dashboard light theme ─────────────── */
const GREEN       = "#10b981";
const GREEN_DARK  = "#059669";
const GREEN_BG    = "#f0fdf4";
const GREEN_BORDER= "#d1fae5";

const SURFACE     = "#ffffff";
const PAGE_BG     = "#f8fafc";        // matches staff dashboard slate-50
const BORDER      = "#e5e7eb";
const TEXT_PRIMARY= "#111827";
const TEXT_SECOND = "#6b7280";
const TEXT_LABEL  = "#374151";
const RADIUS_LG   = 16;
const RADIUS_MD   = 10;
const RADIUS_SM   = 8;

/* ─── Primitives ──────────────────────────────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: RADIUS_LG,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      ...style,
    }}
  >
    {children}
  </div>
);

const CardHeader = ({ left, right }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "18px 24px",
      borderBottom: `1px solid ${BORDER}`,
      background: "#fafafa",
    }}
  >
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 15,
        fontWeight: 700,
        color: TEXT_PRIMARY,
      }}
    >
      {left}
    </span>
    {right && <div>{right}</div>}
  </div>
);

/* Stat card — mirrors the Dashboard stat tiles exactly */
const StatCard = ({ icon: Icon, label, value, sub, valueColor, accent }) => (
  <div
    style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: RADIUS_LG,
      padding: "22px 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      minHeight: 130,
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* subtle top accent stripe */}
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: accent || GREEN,
        borderRadius: "16px 16px 0 0",
      }}
    />
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_SECOND,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      {Icon && (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: RADIUS_SM,
            background: GREEN_BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={16} color={GREEN} />
        </div>
      )}
    </div>
    <div
      style={{
        fontSize: 28,
        fontWeight: 800,
        color: valueColor || TEXT_PRIMARY,
        lineHeight: 1.15,
      }}
    >
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 13, color: TEXT_SECOND, fontWeight: 500 }}>{sub}</div>
    )}
  </div>
);

/* Primary action button */
const BtnPrimary = ({ onClick, disabled, children, style = {} }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "13px 24px",
      background: disabled ? "#e5e7eb" : GREEN,
      color: disabled ? "#9ca3af" : "#ffffff",
      border: "none",
      borderRadius: RADIUS_MD,
      fontSize: 15,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.18s ease",
      boxShadow: disabled ? "none" : "0 2px 8px rgba(16,185,129,0.25)",
      ...style,
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = GREEN_DARK;
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(16,185,129,0.35)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }
    }}
    onMouseLeave={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = GREEN;
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(16,185,129,0.25)";
        e.currentTarget.style.transform = "translateY(0)";
      }
    }}
  >
    {children}
  </button>
);

/* Danger button */
const BtnDanger = ({ onClick, disabled, children, style = {} }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "13px 24px",
      background: disabled ? "#e5e7eb" : "#ef4444",
      color: disabled ? "#9ca3af" : "#ffffff",
      border: "none",
      borderRadius: RADIUS_MD,
      fontSize: 15,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.18s ease",
      boxShadow: disabled ? "none" : "0 2px 8px rgba(239,68,68,0.2)",
      ...style,
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = "#dc2626";
        e.currentTarget.style.transform = "translateY(-1px)";
      }
    }}
    onMouseLeave={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = "#ef4444";
        e.currentTarget.style.transform = "translateY(0)";
      }
    }}
  >
    {children}
  </button>
);

/* Ghost / secondary button */
const BtnGhost = ({ onClick, children, style = {} }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "11px 20px",
      background: "#f9fafb",
      color: TEXT_LABEL,
      border: `1px solid ${BORDER}`,
      borderRadius: RADIUS_MD,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      transition: "background 0.15s",
      ...style,
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "#f9fafb")}
  >
    {children}
  </button>
);

/* Section label divider */
const SectionDivider = ({ children }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      color: TEXT_SECOND,
      padding: "8px 24px",
      background: "#fafafa",
      borderTop: `1px solid ${BORDER}`,
      borderBottom: `1px solid ${BORDER}`,
    }}
  >
    {children}
  </div>
);

/* ─── Main component ──────────────────────────────────────────────────── */
const StaffAttendance = () => {
  const { authTokens } = useAuth();

  const [status, setStatus]                     = useState({ clocked_in: false, attendance: null });
  const [bookings, setBookings]                 = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [logs, setLogs]                         = useState([]);
  const [activeTab, setActiveTab]               = useState("clockinout");

  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [cameraOpen, setCameraOpen]   = useState(false);
  const [activeAction, setActiveAction] = useState("in");

  const [cameraError, setCameraError] = useState(null);
  const [fileFallback, setFileFallback] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError]     = useState(null);
  const [location, setLocation]     = useState({ latitude: null, longitude: null, error: null });
  const [address, setAddress]       = useState("");
  const [addressLoading, setAddressLoading] = useState(false);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg]     = useState("");

  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  /* ── Data loading ── */
  const loadStatusAndData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const statusData = await getCurrentAttendance();
      setStatus(statusData);

      const bookingsRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/bookings/`, {
        headers: { Authorization: `Bearer ${authTokens.access}` },
      });
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData.filter((b) => !["Finished", "Cancelled"].includes(b.status)));
      }

      const logsData = await getAttendanceLogs();
      setLogs(logsData.slice(0, 10));
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load attendance status or bookings data.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Geolocation ── */
  const getCoordinates = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your device browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => {
          let msg = "Failed to retrieve coordinates.";
          if (err.code === err.PERMISSION_DENIED)     msg = "Location permission denied. Please allow GPS access.";
          else if (err.code === err.POSITION_UNAVAILABLE) msg = "Location unavailable. Ensure GPS/Wi-Fi is on.";
          else if (err.code === err.TIMEOUT)          msg = "Location request timed out. Please try again.";
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });

  const reverseGeocode = async (lat, lon) => {
    setAddressLoading(true);
    setAddress("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { Accept: "application/json", "User-Agent": "GardenStudio-App/1.0" } }
      );
      if (res.ok) {
        const data = await res.json();
        setAddress(data.display_name || "Coordinates Resolved");
      } else {
        setAddress("Failed to resolve readable location name");
      }
    } catch {
      setAddress("Failed to resolve readable location name");
    } finally {
      setAddressLoading(false);
    }
  };

  const fetchGPS = async () => {
    setGpsLoading(true);
    setGpsError(null);
    setAddress("");
    try {
      const coords = await getCoordinates();
      setLocation({ latitude: coords.latitude, longitude: coords.longitude, error: null });
      setGpsLoading(false);
      await reverseGeocode(coords.latitude, coords.longitude);
    } catch (err) {
      setGpsError("Location access is required to clock in/out. Please enable GPS and allow browser location permissions.");
      setLocation({ latitude: null, longitude: null, error: err.message });
      setGpsLoading(false);
    }
  };

  const handleRefreshAll = () => { loadStatusAndData(); fetchGPS(); };

  useEffect(() => {
    if (authTokens) { loadStatusAndData(); fetchGPS(); }
  }, [authTokens]);

  /* ── Camera ── */
  const startCamera = async () => {
    setCameraError(null);
    setFileFallback(false);
    setPreviewImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError("Camera access unavailable. Upload a photo instead.");
      setFileFallback(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };

  const handleOpenAttendanceFlow = async (actionType) => {
    setSuccessMsg(""); setErrorMsg("");
    setActiveAction(actionType);
    setCameraOpen(true);
    await startCamera();
  };

  const handleCloseFlow = () => {
    stopCamera(); setCameraOpen(false); setPreviewImage(null);
    setFileFallback(false); setCameraError(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result);
    reader.readAsDataURL(file);
  };

  const captureLivePhoto = () => {
    if (!videoRef.current) return null;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  };

  const handleSubmitClockAction = async () => {
    setActionLoading(true);
    setErrorMsg("");
    const photoData = fileFallback ? previewImage : captureLivePhoto();
    if (!photoData) {
      setErrorMsg("Please take a photo or upload an image as proof of presence.");
      setActionLoading(false);
      return;
    }
    const payload = {
      photo: photoData,
      latitude: location.latitude,
      longitude: location.longitude,
      address: address || null,
      clock_in_address: address || null,
      clock_out_address: address || null,
    };
    if (activeAction === "in") payload.booking_id = selectedBookingId ? parseInt(selectedBookingId) : null;
    try {
      if (activeAction === "in") { await clockIn(payload); setSuccessMsg("Clocked in successfully. Have a great shift!"); }
      else { await clockOut(payload); setSuccessMsg("Clocked out successfully. Shift saved."); }
      handleCloseFlow();
      setSelectedBookingId("");
      await loadStatusAndData();
    } catch (err) {
      setErrorMsg(err.message || "Submission failed. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Helpers ── */
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  const today      = new Date().toDateString();
  const logsToday  = logs.filter((l) => new Date(l.clock_in_time).toDateString() === today);
  const logsEarlier= logs.filter((l) => new Date(l.clock_in_time).toDateString() !== today);

  const totalHours = logs
    .filter((l) => l.total_hours)
    .reduce((s, l) => s + parseFloat(l.total_hours || 0), 0)
    .toFixed(1);

  /* ── Render ── */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: TEXT_PRIMARY,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px" }}>

        {/* ── Page header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: GREEN,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
                flexShrink: 0,
              }}
            >
              <Clock size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY, margin: 0, letterSpacing: "-0.02em" }}>
                Attendance &amp; Time Tracking
              </h1>
              <p style={{ fontSize: 13, color: TEXT_SECOND, marginTop: 3 }}>
                Log daily presence, select project booking, and track your GPS coordinates.
              </p>
            </div>
          </div>

          <button
            onClick={handleRefreshAll}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: TEXT_SECOND,
              border: `1px solid ${BORDER}`,
              background: SURFACE,
              padding: "9px 16px",
              borderRadius: RADIUS_SM,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontWeight: 600,
              transition: "background 0.15s",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = SURFACE)}
          >
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {/* ── Global messages ── */}
        {successMsg && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              background: GREEN_BG,
              border: `1px solid ${GREEN_BORDER}`,
              borderRadius: RADIUS_MD,
              marginBottom: 20,
              fontSize: 14,
              color: "#065f46",
              fontWeight: 600,
            }}
          >
            <CheckCircle2 size={18} color={GREEN} />
            {successMsg}
          </div>
        )}

        {gpsError && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "14px 18px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: RADIUS_MD,
              marginBottom: 20,
              fontSize: 14,
              color: "#991b1b",
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            <AlertCircle size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{gpsError}</div>
            <button
              onClick={fetchGPS}
              style={{
                padding: "5px 12px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Retry GPS
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 18px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: RADIUS_MD,
              marginBottom: 20,
              fontSize: 14,
              color: "#991b1b",
              fontWeight: 600,
            }}
          >
            <AlertCircle size={18} color="#ef4444" />
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 100,
              color: TEXT_SECOND,
              gap: 14,
            }}
          >
            <RefreshCw size={32} color={GREEN} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 14 }}>Fetching your current shift status…</p>
          </div>
        ) : (
          <>
            {/* ── Stat row ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <StatCard
                icon={Activity}
                label="Shift Status"
                value={status.clocked_in ? "Clocked In" : "Clocked Out"}
                valueColor={status.clocked_in ? GREEN : TEXT_SECOND}
                sub={
                  status.clocked_in && status.attendance
                    ? `Since ${fmtTime(status.attendance.clock_in_time)} today`
                    : "No active shift"
                }
                accent={status.clocked_in ? GREEN : "#9ca3af"}
              />
              <StatCard
                icon={Calendar}
                label="Hours This Week"
                value={totalHours}
                sub={`${logs.filter((l) => l.clock_out_time).length} completed shifts`}
              />
              <StatCard
                icon={Briefcase}
                label="Current Project"
                value={
                  status.clocked_in && status.attendance?.booking_label
                    ? status.attendance.booking_label.length > 18
                      ? status.attendance.booking_label.slice(0, 18) + "…"
                      : status.attendance.booking_label
                    : "—"
                }
                sub={
                  status.clocked_in && status.attendance
                    ? "Active project assignment"
                    : "No project assigned"
                }
              />
            </div>

            {/* ── Main content grid ── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 300px",
                gap: 20,
                alignItems: "start",
              }}
            >
              {/* Left column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Shift Overview card */}
                <Card>
                  <CardHeader
                    left={
                      <>
                        <UserCheck size={17} color={GREEN} />
                        Shift Overview
                      </>
                    }
                    right={
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          background: "#f3f4f6",
                          borderRadius: RADIUS_SM,
                          padding: 4,
                        }}
                      >
                        {[
                          { key: "clockinout", label: "Clock In/Out" },
                          { key: "history",    label: "History" },
                        ].map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              padding: "6px 14px",
                              borderRadius: 6,
                              border: "none",
                              cursor: "pointer",
                              background: activeTab === t.key ? SURFACE : "transparent",
                              color: activeTab === t.key ? TEXT_PRIMARY : TEXT_SECOND,
                              boxShadow: activeTab === t.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                              transition: "all 0.15s",
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    }
                  />

                  {activeTab === "clockinout" && (
                    <>
                      {/* Status banner */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "18px 24px",
                          borderBottom: `1px solid ${BORDER}`,
                          background: status.clocked_in ? GREEN_BG : "#fafafa",
                        }}
                      >
                        <div
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: "50%",
                            background: status.clocked_in ? GREEN : "#9ca3af",
                            boxShadow: status.clocked_in ? `0 0 0 4px rgba(16,185,129,0.18)` : "none",
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRIMARY }}>
                            {status.clocked_in ? "Currently Clocked In" : "Currently Clocked Out"}
                          </div>
                          {status.clocked_in && status.attendance && (
                            <div style={{ fontSize: 13, color: TEXT_SECOND, marginTop: 3 }}>
                              {fmtTime(status.attendance.clock_in_time)} · {fmtDate(status.attendance.clock_in_time)}
                              {" · "}
                              <span style={{ color: GREEN, fontWeight: 700 }}>
                                {status.attendance.booking_label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Booking selector */}
                      {!status.clocked_in && (
                        <div
                          style={{
                            padding: "18px 24px",
                            borderBottom: `1px solid ${BORDER}`,
                          }}
                        >
                          <label
                            style={{
                              display: "block",
                              fontSize: 12,
                              fontWeight: 700,
                              color: TEXT_SECOND,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              marginBottom: 8,
                            }}
                          >
                            Assign to Booking / Project
                          </label>
                          <select
                            value={selectedBookingId}
                            onChange={(e) => setSelectedBookingId(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: `1px solid ${BORDER}`,
                              borderRadius: RADIUS_SM,
                              fontSize: 14,
                              color: TEXT_PRIMARY,
                              background: SURFACE,
                              cursor: "pointer",
                              outline: "none",
                              fontFamily: "inherit",
                            }}
                          >
                            <option value="">General Work (No Specific Booking)</option>
                            {bookings.map((b) => (
                              <option key={b.id} value={b.id}>
                                #{b.id} – {b.service_type} ({b.customer_name})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Action button */}
                      <div style={{ padding: "20px 24px" }}>
                        {status.clocked_in ? (
                          <BtnDanger
                            onClick={() => handleOpenAttendanceFlow("out")}
                            disabled={gpsLoading || !!gpsError}
                            style={{ width: "100%" }}
                          >
                            {gpsLoading ? (
                              <><RefreshCw size={16} className="animate-spin" /> Acquiring GPS…</>
                            ) : gpsError ? (
                              <><AlertCircle size={16} /> GPS Required</>
                            ) : (
                              <><LogOut size={16} /> Clock Out Shift</>
                            )}
                          </BtnDanger>
                        ) : (
                          <BtnPrimary
                            onClick={() => handleOpenAttendanceFlow("in")}
                            disabled={gpsLoading || !!gpsError}
                            style={{ width: "100%" }}
                          >
                            {gpsLoading ? (
                              <><RefreshCw size={16} className="animate-spin" /> Acquiring GPS…</>
                            ) : gpsError ? (
                              <><AlertCircle size={16} /> GPS Required</>
                            ) : (
                              <><LogIn size={16} /> Clock In Shift</>
                            )}
                          </BtnPrimary>
                        )}
                      </div>
                    </>
                  )}

                  {activeTab === "history" && (
                    <div>
                      {logs.length === 0 ? (
                        <div style={{ padding: "48px 24px", textAlign: "center", color: TEXT_SECOND, fontSize: 14 }}>
                          No attendance logs recorded yet.
                        </div>
                      ) : (
                        <>
                          {logsToday.length > 0 && (
                            <>
                              <SectionDivider>Today</SectionDivider>
                              {logsToday.map((log) => (
                                <LogRow key={log.id} log={log} fmtTime={fmtTime} fmtDate={fmtDate} />
                              ))}
                            </>
                          )}
                          {logsEarlier.length > 0 && (
                            <>
                              <SectionDivider>Earlier</SectionDivider>
                              {logsEarlier.map((log) => (
                                <LogRow key={log.id} log={log} fmtTime={fmtTime} fmtDate={fmtDate} />
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Card>

                {/* Recent Log History (visible in clockinout tab) */}
                {activeTab === "clockinout" && logs.length > 0 && (
                  <Card>
                    <CardHeader
                      left={<><History size={17} color={GREEN} />Recent Log History</>}
                      right={
                        <span style={{ fontSize: 12, color: TEXT_SECOND, fontWeight: 600 }}>
                          Last {logs.length} entries
                        </span>
                      }
                    />
                    {logsToday.length > 0 && (
                      <>
                        <SectionDivider>Today</SectionDivider>
                        {logsToday.map((log) => (
                          <LogRow key={log.id} log={log} fmtTime={fmtTime} fmtDate={fmtDate} />
                        ))}
                      </>
                    )}
                    {logsEarlier.length > 0 && (
                      <>
                        <SectionDivider>Earlier</SectionDivider>
                        {logsEarlier.slice(0, 4).map((log) => (
                          <LogRow key={log.id} log={log} fmtTime={fmtTime} fmtDate={fmtDate} />
                        ))}
                      </>
                    )}
                  </Card>
                )}
              </div>

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* GPS card */}
                <Card>
                  <CardHeader left={<><MapPin size={17} color={GREEN} />GPS Tracking</>} />
                  <div style={{ padding: "18px 20px" }}>
                    {gpsLoading ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "14px 16px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: RADIUS_SM,
                        }}
                      >
                        <RefreshCw size={17} color="#3b82f6" className="animate-spin" />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8" }}>Acquiring GPS…</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Fetching device coordinates</div>
                        </div>
                      </div>
                    ) : gpsError ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "14px 16px",
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: RADIUS_SM,
                        }}
                      >
                        <MapPin size={17} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>GPS Unavailable</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Allow location in browser settings.</div>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: "14px 16px",
                          background: GREEN_BG,
                          border: `1px solid ${GREEN_BORDER}`,
                          borderRadius: RADIUS_SM,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <MapPin size={15} color={GREEN} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#065f46" }}>Location Acquired</span>
                        </div>
                        <div style={{ fontSize: 12, color: TEXT_SECOND, fontFamily: "monospace", marginBottom: 6 }}>
                          {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                        </div>
                        {addressLoading && (
                          <div style={{ fontSize: 12, color: "#3b82f6", display: "flex", alignItems: "center", gap: 5 }}>
                            <RefreshCw size={11} className="animate-spin" /> Resolving address…
                          </div>
                        )}
                        {!addressLoading && address && (
                          <div style={{ fontSize: 12, color: TEXT_LABEL, lineHeight: 1.5 }}>
                            <span style={{ color: TEXT_SECOND, fontWeight: 600 }}>Address: </span>
                            {address}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Compliance checklist */}
                <Card>
                  <CardHeader left={<><CheckCircle2 size={17} color={GREEN} />Compliance Checklist</>} />
                  <div style={{ padding: "18px 20px" }}>
                    {[
                      "Enable geolocation to verify your presence at the client site.",
                      "Capture a clear, live snapshot showing you at the service location.",
                      "Always clock out at shift end to record precise working hours.",
                    ].map((text, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          marginBottom: i < 2 ? 14 : 0,
                          fontSize: 13,
                          color: TEXT_LABEL,
                          lineHeight: 1.55,
                        }}
                      >
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            background: GREEN_BG,
                            border: `1px solid ${GREEN_BORDER}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          <CheckCircle2 size={12} color={GREEN} />
                        </div>
                        {text}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Camera modal ── */}
      {cameraOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              width: "100%",
              maxWidth: 480,
              overflow: "hidden",
              boxShadow: "0 20px 40px -12px rgba(0,0,0,0.18)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 24px",
                borderBottom: `1px solid ${BORDER}`,
                background: "#fafafa",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                }}
              >
                <Camera size={17} color={GREEN} />
                Presence Verification ·{" "}
                <span style={{ color: GREEN }}>Clock {activeAction === "in" ? "In" : "Out"}</span>
              </span>
              <button
                onClick={handleCloseFlow}
                style={{
                  fontSize: 13,
                  color: TEXT_SECOND,
                  border: `1px solid ${BORDER}`,
                  background: SURFACE,
                  cursor: "pointer",
                  padding: "5px 12px",
                  borderRadius: RADIUS_SM,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
            </div>

            {/* GPS banner in modal */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "12px 24px",
                background: GREEN_BG,
                borderBottom: `1px solid ${GREEN_BORDER}`,
                fontSize: 13,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={14} color={GREEN} />
                <span style={{ color: TEXT_SECOND }}>GPS Verified:</span>
                <span style={{ color: GREEN_DARK, fontWeight: 700 }}>
                  {location.latitude?.toFixed(4)}, {location.longitude?.toFixed(4)}
                </span>
              </div>
              {address && (
                <div style={{ fontSize: 12, color: TEXT_SECOND, paddingLeft: 22, lineHeight: 1.4 }}>
                  {address}
                </div>
              )}
            </div>

            {/* Camera preview */}
            <div
              style={{
                margin: "20px 24px",
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${BORDER}`,
                background: "#111827",
                aspectRatio: "16/9",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!fileFallback ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 10,
                      background: "rgba(0,0,0,0.6)",
                      color: GREEN,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: GREEN,
                        display: "inline-block",
                        animation: "ping 1.5s infinite",
                      }}
                    />
                    Live
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    gap: 14,
                    padding: 24,
                  }}
                >
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Preview"
                      style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", borderRadius: 8 }}
                    />
                  ) : (
                    <>
                      <Video size={32} color="#4b5563" />
                      <p style={{ fontSize: 13, color: "#9ca3af" }}>Upload a photo as proof of presence</p>
                    </>
                  )}
                  <label
                    style={{
                      padding: "8px 16px",
                      background: GREEN_BG,
                      border: `1px solid ${GREEN_BORDER}`,
                      borderRadius: RADIUS_SM,
                      fontSize: 13,
                      fontWeight: 700,
                      color: GREEN_DARK,
                      cursor: "pointer",
                    }}
                  >
                    {previewImage ? "Change Photo" : "Select Image Proof"}
                    <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: "none" }} />
                  </label>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "18px 24px",
                borderTop: `1px solid ${BORDER}`,
                background: "#fafafa",
              }}
            >
              <BtnGhost onClick={handleCloseFlow} style={{ flex: 1 }}>
                Cancel
              </BtnGhost>
              <BtnPrimary
                onClick={handleSubmitClockAction}
                disabled={actionLoading}
                style={{ flex: 2 }}
              >
                {actionLoading ? (
                  <><RefreshCw size={15} className="animate-spin" /> Saving shift…</>
                ) : (
                  <><Clock size={15} /> Verify &amp; Clock {activeAction === "in" ? "In" : "Out"}</>
                )}
              </BtnPrimary>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ping { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .animate-spin { animation: spin 1s linear infinite; }
        select:focus { outline: 2px solid ${GREEN}; outline-offset: 1px; }
      `}</style>
    </div>
  );
};

/* ── Log row ── */
const LogRow = ({ log, fmtTime, fmtDate }) => {
  const GREEN      = "#10b981";
  const BORDER     = "#e5e7eb";
  const TEXT_PRIMARY = "#111827";
  const TEXT_SECOND  = "#6b7280";
  const isActive   = !log.clock_out_time;
  const label      =
    log.booking_label && log.booking_label !== "General"
      ? log.booking_label.split(" - ").slice(1).join(" - ") || log.booking_label
      : "General Attendance";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: `1px solid ${BORDER}`,
        gap: 16,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
        <div
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: isActive ? GREEN : "#d1d5db",
            boxShadow: isActive ? `0 0 0 3px rgba(16,185,129,0.18)` : "none",
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY }}>{label}</div>
          <div style={{ fontSize: 12, color: TEXT_SECOND, marginTop: 3 }}>
            {fmtDate(log.clock_in_time)} · {fmtTime(log.clock_in_time)}
          </div>
          {log.clock_in_address && (
            <div style={{ fontSize: 11, color: TEXT_SECOND, marginTop: 3, fontStyle: "italic", lineHeight: 1.3 }}>
              {log.clock_in_address}
            </div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {isActive ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>In Progress</div>
            <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>Active</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 800, color: GREEN }}>{log.total_hours} hrs</div>
            <div style={{ fontSize: 12, color: TEXT_SECOND, marginTop: 2 }}>Out: {fmtTime(log.clock_out_time)}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default StaffAttendance;
