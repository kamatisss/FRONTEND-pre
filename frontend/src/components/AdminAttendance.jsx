import React, { useState, useEffect } from "react";
import { getAttendanceLogs } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  Clock,
  MapPin,
  Eye,
  Search,
  RefreshCw,
  Filter,
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  ExternalLink,
} from "lucide-react";

/* ─── Design tokens ───────────────────────────────────────────────────── */
const GREEN      = "#10b981";
const GREEN_DARK = "#059669";
const GREEN_BG   = "#f0fdf4";
const GREEN_BORDER = "#bbf7d0";

/* ─── Primitives ──────────────────────────────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: "#ffffff",
      border: "0.5px solid #e5e7eb",
      borderRadius: 12,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

const CardHeader = ({ children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 20px",
      borderBottom: "0.5px solid #e5e7eb",
    }}
  >
    {children}
  </div>
);

const CardTitle = ({ icon: Icon, children }) => (
  <span
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      fontWeight: 600,
      color: "#111827",
    }}
  >
    {Icon && <Icon size={16} color={GREEN} />}
    {children}
  </span>
);

const StatCard = ({ label, value, valueColor = "#111827", accent }) => (
  <div
    style={{
      background: "#f9fafb",
      borderRadius: 8,
      padding: "14px 16px",
      borderLeft: `3px solid ${accent}`,
    }}
  >
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: valueColor }}>
      {value}
    </div>
  </div>
);

const Badge = ({ children, color = "gray" }) => {
  const map = {
    amber:  { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
    green:  { bg: GREEN_BG,  text: GREEN_DARK, border: GREEN_BORDER },
    gray:   { bg: "#f3f4f6", text: "#374151",  border: "#e5e7eb" },
  };
  const c = map[color] || map.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        border: `0.5px solid ${c.border}`,
      }}
    >
      {children}
    </span>
  );
};

/* ─── Main component ──────────────────────────────────────────────────── */
const AdminAttendance = () => {
  const { authTokens } = useAuth();
  const [logs, setLogs]                         = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [errorMsg, setErrorMsg]                 = useState("");
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [searchTerm, setSearchTerm]             = useState("");
  const [filterProject, setFilterProject]       = useState("all");

  const loadLogs = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getAttendanceLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load attendance logs. Please verify permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authTokens) loadLogs();
  }, [authTokens]);

  const getPhotoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000'}${url}`;
  };

  const filteredLogs = logs.filter((log) => {
    const matchesName = log.staff_name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    let matchesProject = true;
    if (filterProject === "general")  matchesProject = !log.booking;
    if (filterProject === "assigned") matchesProject = !!log.booking;
    return matchesName && matchesProject;
  });

  const totalShifts      = logs.length;
  const activeShifts     = logs.filter((l) => !l.clock_out_time).length;
  const completedShifts  = totalShifts - activeShifts;
  const totalHours       = logs
    .reduce((s, l) => s + (parseFloat(l.total_hours) || 0), 0)
    .toFixed(1);

  const fmtTime = (iso) =>
    iso
      ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—";
  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString() : "—";
  const fmtDateTime = (iso) =>
    iso ? new Date(iso).toLocaleString() : "—";

  /* ── RENDER ────────────────────────────────────────────────────────── */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* ── Page header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: GREEN_BG,
                border: `0.5px solid ${GREEN_BORDER}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserCheck size={20} color={GREEN} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
                Attendance Tracking
              </h1>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                Verify staff presence, review photo proof, and audit shift hours
              </p>
            </div>
          </div>

          <button
            onClick={loadLogs}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#6b7280",
              border: "0.5px solid #e5e7eb",
              background: "#ffffff",
              padding: "7px 14px",
              borderRadius: 8,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw
              size={14}
              style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
            />
            Refresh logs
          </button>
        </div>

        {/* ── Stat row ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <StatCard label="Total shift logs"    value={totalShifts}           accent={GREEN}     valueColor="#111827" />
          <StatCard label="Active shifts"       value={activeShifts}          accent="#f59e0b"   valueColor="#d97706" />
          <StatCard label="Completed shifts"    value={completedShifts}       accent="#14b8a6"   valueColor="#0f766e" />
          <StatCard label="Total hours logged"  value={`${totalHours} hrs`}   accent="#6366f1"   valueColor="#4338ca" />
        </div>

        {/* ── Error ── */}
        {errorMsg && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              background: "#fef2f2",
              border: "0.5px solid #fecaca",
              borderRadius: 8,
              marginBottom: 20,
              fontSize: 13,
              color: "#b91c1c",
              fontWeight: 500,
            }}
          >
            <ShieldAlert size={16} color="#ef4444" />
            {errorMsg}
          </div>
        )}

        {/* ── Filter bar ── */}
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              flexWrap: "wrap",
            }}
          >
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
              <Search
                size={14}
                color="#9ca3af"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                placeholder="Search staff by name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#111827",
                  background: "#f9fafb",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Project filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={14} color="#9ca3af" />
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#374151",
                  background: "#f9fafb",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All assignments</option>
                <option value="assigned">Assigned to booking</option>
                <option value="general">General attendance</option>
              </select>
            </div>

            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>
              {filteredLogs.length} result{filteredLogs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </Card>

        {/* ── Table ── */}
        {loading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 80,
              color: "#6b7280",
              gap: 12,
            }}
          >
            <RefreshCw
              size={28}
              color={GREEN}
              style={{ animation: "spin 1s linear infinite" }}
            />
            <p style={{ fontSize: 13 }}>Loading attendance logs…</p>
          </div>
        ) : (
          <Card>
            {filteredLogs.length === 0 ? (
              <div
                style={{
                  padding: "48px 20px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: 13,
                }}
              >
                No matching shift logs found.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                      {["Staff member", "Date", "Booking / project", "Time in", "Time out", "Hours", "Action"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              padding: "10px 16px",
                              textAlign: "left",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#6b7280",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log, idx) => (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom:
                            idx < filteredLogs.length - 1
                              ? "0.5px solid #f3f4f6"
                              : "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f9fafb")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        {/* Staff */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: GREEN_BG,
                                border: `0.5px solid ${GREEN_BORDER}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: GREEN_DARK,
                                flexShrink: 0,
                              }}
                            >
                              {log.staff_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <span style={{ fontWeight: 600, color: "#111827" }}>
                              {log.staff_name}
                            </span>
                          </div>
                        </td>

                        {/* Date */}
                        <td style={{ padding: "12px 16px", color: "#374151", whiteSpace: "nowrap" }}>
                          {fmtDate(log.clock_in_time)}
                        </td>

                        {/* Booking */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {log.booking ? (
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#4338ca",
                                background: "#eef2ff",
                                border: "0.5px solid #c7d2fe",
                                borderRadius: 6,
                                padding: "2px 8px",
                              }}
                            >
                              #{log.booking}
                            </span>
                          ) : (
                            <Badge color="gray">General</Badge>
                          )}
                        </td>

                        {/* Time in */}
                        <td style={{ padding: "12px 16px", color: "#374151", whiteSpace: "nowrap" }}>
                          {fmtTime(log.clock_in_time)}
                        </td>

                        {/* Time out */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {log.clock_out_time ? (
                            <span style={{ color: "#374151" }}>
                              {fmtTime(log.clock_out_time)}
                            </span>
                          ) : (
                            <Badge color="amber">Active shift</Badge>
                          )}
                        </td>

                        {/* Hours */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          {log.total_hours != null ? (
                            <span 
                              className={Number(log.total_hours || 0) === 0 ? "text-slate-400 font-semibold" : "text-emerald-600 font-semibold"}
                            >
                              {log.total_hours} hrs
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Action */}
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                          <button
                            onClick={() => setSelectedAttendance(log)}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                          >
                            View Proof
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ── Proof modal ── */}
      {selectedAttendance && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 999,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "0.5px solid #e5e7eb",
              borderRadius: 14,
              width: "100%",
              maxWidth: 540,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "0.5px solid #e5e7eb",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                <UserCheck size={16} color={GREEN} />
                Shift proof verification
              </span>
              <button
                onClick={() => setSelectedAttendance(null)}
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  color: "#9ca3af",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: "20px" }}>

              {/* Details grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 1,
                  background: "#e5e7eb",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: 10,
                  overflow: "hidden",
                  marginBottom: 20,
                  fontSize: 13,
                }}
              >
                {[
                  { label: "Staff member",      value: selectedAttendance.staff_name },
                  { label: "Booking reference", value: selectedAttendance.booking_label },
                  { label: "Clock in",          value: fmtDateTime(selectedAttendance.clock_in_time) },
                  { label: "Clock out",         value: selectedAttendance.clock_out_time ? fmtDateTime(selectedAttendance.clock_out_time) : "Active shift" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{ background: "#ffffff", padding: "12px 14px" }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#9ca3af",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontWeight: 600, color: "#111827" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Photo proofs */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 10,
                  }}
                >
                  Photo proofs
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Clock-in photo",  url: selectedAttendance.clock_in_photo_url },
                    { label: "Clock-out photo", url: selectedAttendance.clock_out_photo_url },
                  ].map(({ label, url }) => (
                    <div
                      key={label}
                      style={{
                        border: "0.5px solid #e5e7eb",
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#f9fafb",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          padding: "6px 10px",
                          borderBottom: "0.5px solid #e5e7eb",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {label}
                      </div>
                      {getPhotoUrl(url) ? (
                        <img
                          src={getPhotoUrl(url)}
                          alt={label}
                          style={{
                            width: "100%",
                            aspectRatio: "4/3",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "4/3",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            color: "#9ca3af",
                          }}
                        >
                          No image uploaded
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* GPS block */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 14px",
                  background: selectedAttendance.latitude ? GREEN_BG : "#fef2f2",
                  border: `0.5px solid ${selectedAttendance.latitude ? GREEN_BORDER : "#fecaca"}`,
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: selectedAttendance.latitude ? GREEN_DARK : "#b91c1c",
                      marginBottom: 4,
                    }}
                  >
                    <MapPin size={14} />
                    Tracked site location
                  </div>
                  {selectedAttendance.latitude && selectedAttendance.longitude ? (
                    <>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px 0" }}>
                        Coordinates: {selectedAttendance.latitude.toFixed(6)}, {selectedAttendance.longitude.toFixed(6)}
                      </p>
                      {selectedAttendance.clock_in_address && (
                        <p style={{ fontSize: 12, color: "#374151", margin: "4px 0 0 0", wordBreak: "break-word", lineHeight: 1.4 }}>
                          <strong>Clock In:</strong> {selectedAttendance.clock_in_address}
                        </p>
                      )}
                      {selectedAttendance.clock_out_address && (
                        <p style={{ fontSize: 12, color: "#374151", margin: "4px 0 0 0", wordBreak: "break-word", lineHeight: 1.4 }}>
                          <strong>Clock Out:</strong> {selectedAttendance.clock_out_address}
                        </p>
                      )}
                      {!selectedAttendance.clock_in_address && !selectedAttendance.clock_out_address && (
                        <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0 0", fontStyle: "italic" }}>
                          Address not recorded
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>
                      No GPS coordinates recorded
                    </p>
                  )}
                </div>
                {selectedAttendance.latitude && selectedAttendance.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedAttendance.latitude},${selectedAttendance.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "7px 14px",
                      background: GREEN,
                      color: "#ffffff",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "none",
                      flexShrink: 0,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = GREEN_DARK)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = GREEN)}
                  >
                    <ExternalLink size={12} />
                    Open in Maps
                  </a>
                )}
              </div>

              {/* Close */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setSelectedAttendance(null)}
                  style={{
                    padding: "8px 20px",
                    background: "#f3f4f6",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AdminAttendance;
