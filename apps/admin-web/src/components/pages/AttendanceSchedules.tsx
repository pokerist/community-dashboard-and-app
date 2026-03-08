import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock, CalendarDays, Users, RefreshCw, Search,
  LogIn, LogOut, ChevronRight, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import compoundStaffService, {
  type AttendanceLog,
  type CompoundStaff,
  type CompoundStaffSchedule,
  type BlueCollarWeekDay,
  WEEK_DAYS,
} from "../../lib/compound-staff-service";
import { errorMessage, formatDateTime, humanizeEnum } from "../../lib/live-data";
import { StatusBadge } from "../StatusBadge";

// ── Helpers ──────────────────────────────────────────────────

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D", "#7C3AED"];
const DAY_SHORT: Record<BlueCollarWeekDay, string> = {
  SUNDAY: "Sun", MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
  THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat",
};

function formatDuration(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// ── Primitive UI ─────────────────────────────────────────────

function PrimaryBtn({ label, icon, onClick, loading: ld = false, accent = "#2563EB" }: { label: string; icon?: React.ReactNode; onClick: () => void; loading?: boolean; accent?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={ld} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", background: hov ? `${accent}DD` : accent, color: "#FFF", border: "none", cursor: ld ? "not-allowed" : "pointer", fontSize: "12.5px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", boxShadow: `0 1px 3px ${accent}40`, opacity: ld ? 0.7 : 1, flexShrink: 0 }}>
      {icon}{ld ? "Processing…" : label}
    </button>
  );
}

function OutlineBtn({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 11px", borderRadius: "7px", background: hov ? "#F5F5F5" : "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: "pointer", fontSize: "12px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
      {icon}{label}
    </button>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box" };

function StatCard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div style={{ flex: 1, padding: "14px 16px", background: "#FFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", borderTop: `3px solid ${accent}`, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{value}</p>
          <p style={{ marginTop: "3px", fontSize: "11px", color: "#9CA3AF" }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Schedule grid (week view for a single staff member) ──────

function ScheduleWeekGrid({ schedules }: { schedules: CompoundStaffSchedule[] }) {
  const byDay = useMemo(() => {
    const map = new Map<BlueCollarWeekDay, CompoundStaffSchedule>();
    schedules.forEach((s) => map.set(s.dayOfWeek, s));
    return map;
  }, [schedules]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
      {WEEK_DAYS.map((day) => {
        const sched = byDay.get(day);
        const hasShift = sched?.isActive && sched.startTime && sched.endTime;
        return (
          <div key={day} style={{
            padding: "8px 6px", borderRadius: "6px", textAlign: "center",
            background: hasShift ? "#EFF6FF" : "#FAFAFA",
            border: `1px solid ${hasShift ? "#BFDBFE" : "#F3F4F6"}`,
          }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: hasShift ? "#2563EB" : "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>{DAY_SHORT[day]}</p>
            {hasShift ? (
              <>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "#1E40AF", marginTop: "4px", fontFamily: "'DM Mono', monospace" }}>
                  {sched.startTime}
                </p>
                <p style={{ fontSize: "9px", color: "#6B7280", margin: "1px 0" }}>to</p>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "#1E40AF", fontFamily: "'DM Mono', monospace" }}>
                  {sched.endTime}
                </p>
              </>
            ) : (
              <p style={{ fontSize: "10px", color: "#D1D5DB", marginTop: "4px" }}>Off</p>
            )}
            {sched?.notes && (
              <p style={{ fontSize: "9px", color: "#6B7280", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sched.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Attendance log row ───────────────────────────────────────

function AttendanceRow({ log }: { log: AttendanceLog }) {
  const isOpen = !log.clockOutAt;
  const today = isToday(log.clockInAt);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "10px 12px", borderRadius: "8px",
      border: `1px solid ${isOpen ? "#FDE68A" : "#F3F4F6"}`,
      background: isOpen ? "#FFFBEB" : "#FAFAFA",
    }}>
      {/* Clock-in icon */}
      <div style={{
        width: "30px", height: "30px", borderRadius: "7px",
        background: isOpen ? "#FEF3C7" : "#ECFDF5",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        color: isOpen ? "#D97706" : "#059669",
      }}>
        {isOpen ? <Clock style={{ width: "13px", height: "13px" }} /> : <LogOut style={{ width: "13px", height: "13px" }} />}
      </div>

      {/* Date + times */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#111827" }}>
            {today ? "Today" : formatDateShort(log.clockInAt)}
          </span>
          {isOpen && (
            <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#FEF3C7", color: "#B45309", textTransform: "uppercase", letterSpacing: "0.06em" }}>In Progress</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
          <LogIn style={{ width: "10px", height: "10px", color: "#059669" }} />
          <span style={{ fontSize: "11px", color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>{formatTime(log.clockInAt)}</span>
          {log.clockOutAt && (
            <>
              <span style={{ color: "#D1D5DB", margin: "0 2px" }}>→</span>
              <LogOut style={{ width: "10px", height: "10px", color: "#DC2626" }} />
              <span style={{ fontSize: "11px", color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>{formatTime(log.clockOutAt)}</span>
            </>
          )}
        </div>
      </div>

      {/* Duration */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", fontFamily: "'DM Mono', monospace" }}>
          {formatDuration(log.durationMin)}
        </p>
        {log.notes && <p style={{ fontSize: "10px", color: "#9CA3AF", marginTop: "1px" }}>{log.notes}</p>}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export function AttendanceSchedules() {
  const [staffList, setStaffList] = useState<CompoundStaff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  const selected = useMemo(() => staffList.find((s) => s.id === selectedId) ?? null, [staffList, selectedId]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((s) =>
      [s.fullName, s.profession, s.jobTitle ?? "", s.phone].join(" ").toLowerCase().includes(q),
    );
  }, [staffList, search]);

  const openSession = useMemo(() => attendance.find((a) => !a.clockOutAt) ?? null, [attendance]);

  const todayLogs = useMemo(() => attendance.filter((a) => isToday(a.clockInAt)), [attendance]);
  const todayHours = useMemo(() => {
    let mins = 0;
    todayLogs.forEach((l) => { if (l.durationMin) mins += l.durationMin; });
    return formatDuration(mins || null);
  }, [todayLogs]);

  const weekHours = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let mins = 0;
    attendance.forEach((l) => {
      if (new Date(l.clockInAt) >= weekAgo && l.durationMin) mins += l.durationMin;
    });
    return formatDuration(mins || null);
  }, [attendance]);

  // ── Loaders ──────────────────────────────────────────────────

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await compoundStaffService.list({ status: "ACTIVE" });
      setStaffList(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
    } catch (e) { toast.error("Failed to load staff", { description: errorMessage(e) }); }
    finally { setLoading(false); }
  }, [selectedId]);

  const loadAttendance = useCallback(async (id: string) => {
    if (!id) { setAttendance([]); return; }
    setAttLoading(true);
    try { setAttendance(await compoundStaffService.getAttendance(id)); }
    catch (e) { toast.error("Failed to load attendance", { description: errorMessage(e) }); }
    finally { setAttLoading(false); }
  }, []);

  useEffect(() => { void loadStaff(); }, []); // eslint-disable-line
  useEffect(() => { if (selectedId) void loadAttendance(selectedId); }, [selectedId, loadAttendance]);

  // ── Actions ──────────────────────────────────────────────────

  const handleClockIn = async () => {
    if (!selectedId) return;
    setClockLoading(true);
    try {
      await compoundStaffService.clockIn(selectedId);
      toast.success("Clocked in successfully");
      await loadAttendance(selectedId);
    } catch (e) { toast.error("Clock-in failed", { description: errorMessage(e) }); }
    finally { setClockLoading(false); }
  };

  const handleClockOut = async () => {
    if (!selectedId) return;
    setClockLoading(true);
    try {
      await compoundStaffService.clockOut(selectedId);
      toast.success("Clocked out successfully");
      await loadAttendance(selectedId);
    } catch (e) { toast.error("Clock-out failed", { description: errorMessage(e) }); }
    finally { setClockLoading(false); }
  };

  // ── Stats ────────────────────────────────────────────────────

  const activeStaffCount = staffList.length;
  const scheduledDays = selected?.schedules?.filter((s) => s.isActive && s.startTime).length ?? 0;

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`
        .att-staff-btn { transition: all 120ms ease; }
        .att-staff-btn:hover { background: #F9FAFB !important; }
      `}</style>

      {/* ── Page header ────────────────────────────────────── */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>Attendance & Schedules</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Track staff clock-ins, clock-outs, and weekly work schedules</p>
        </div>
        <OutlineBtn label="Refresh" icon={<RefreshCw style={{ width: "12px", height: "12px" }} />} onClick={() => { void loadStaff(); if (selectedId) void loadAttendance(selectedId); }} />
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatCard label="Active Staff" value={activeStaffCount} accent={ACCENTS[1]} icon={<Users style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Today's Hours" value={selected ? todayHours : "—"} accent={ACCENTS[0]} icon={<Clock style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Week Hours" value={selected ? weekHours : "—"} accent={ACCENTS[2]} icon={<CalendarDays style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Scheduled Days" value={selected ? `${scheduledDays}/7` : "—"} accent={ACCENTS[3]} icon={<CalendarDays style={{ width: "16px", height: "16px" }} />} />
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "16px", alignItems: "start" }}>

        {/* ══ LEFT: Staff list ════════════════════════════════ */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Users style={{ width: "14px", height: "14px", color: "#2563EB" }} />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Staff</span>
              <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: "#EFF6FF", color: "#2563EB", fontFamily: "'DM Mono', monospace" }}>{filteredStaff.length}</span>
            </div>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
              <input placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: "32px", fontSize: "12.5px", background: "#F9FAFB" }} />
            </div>
          </div>

          <div style={{ maxHeight: "calc(100vh - 380px)", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ height: "48px", borderRadius: "8px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
                ))}
              </div>
            ) : filteredStaff.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <p style={{ fontSize: "12px", color: "#9CA3AF" }}>No active staff found</p>
              </div>
            ) : (
              filteredStaff.map((s) => {
                const isSel = s.id === selectedId;
                return (
                  <button key={s.id} type="button" className="att-staff-btn"
                    onClick={() => setSelectedId(s.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px", border: "none", borderLeft: `3px solid ${isSel ? "#2563EB" : "transparent"}`,
                      background: isSel ? "#F5F9FF" : "#FFF", cursor: "pointer", textAlign: "left",
                      borderBottom: "1px solid #F3F4F6", transition: "all 120ms ease",
                    }}>
                    {/* Avatar */}
                    <div style={{
                      width: "34px", height: "34px", borderRadius: "8px",
                      background: isSel ? "#2563EB" : "#F3F4F6",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      fontSize: "11px", fontWeight: 700, color: isSel ? "#FFF" : "#6B7280",
                    }}>
                      {s.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.fullName}</p>
                      <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px" }}>{s.profession}{s.jobTitle ? ` · ${s.jobTitle}` : ""}</p>
                    </div>
                    <ChevronRight style={{ width: "12px", height: "12px", color: isSel ? "#2563EB" : "#D1D5DB", flexShrink: 0 }} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ══ RIGHT: Detail panel ════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {!selected ? (
            <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Users style={{ width: "18px", height: "18px", color: "#D1D5DB" }} />
              </div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280" }}>No staff selected</p>
              <p style={{ marginTop: "4px", fontSize: "11.5px", color: "#9CA3AF", lineHeight: 1.5 }}>Select a staff member to view attendance and schedule.</p>
            </div>
          ) : (
            <>
              {/* ── Staff header + clock actions ──────────────── */}
              <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  {/* Info */}
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "9px", background: "#EFF6FF",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    fontSize: "13px", fontWeight: 700, color: "#2563EB",
                  }}>
                    {selected.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{selected.fullName}</p>
                      <StatusBadge value={selected.status} />
                    </div>
                    <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>
                      {selected.profession}{selected.jobTitle ? ` · ${selected.jobTitle}` : ""} · {selected.phone}
                    </p>
                  </div>

                  {/* Clock actions */}
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                    {openSession ? (
                      <PrimaryBtn
                        label="Clock Out"
                        icon={<LogOut style={{ width: "13px", height: "13px" }} />}
                        onClick={() => void handleClockOut()}
                        loading={clockLoading}
                        accent="#DC2626"
                      />
                    ) : (
                      <PrimaryBtn
                        label="Clock In"
                        icon={<LogIn style={{ width: "13px", height: "13px" }} />}
                        onClick={() => void handleClockIn()}
                        loading={clockLoading}
                        accent="#059669"
                      />
                    )}
                  </div>
                </div>

                {/* Open session banner */}
                {openSession && (
                  <div style={{ padding: "8px 20px", background: "#FFFBEB", borderTop: "1px solid #FDE68A", display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertCircle style={{ width: "13px", height: "13px", color: "#D97706", flexShrink: 0 }} />
                    <p style={{ fontSize: "12px", color: "#92400E" }}>
                      Active session since <strong>{formatTime(openSession.clockInAt)}</strong> — clock out when done.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Schedule card ─────────────────────────────── */}
              <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "8px" }}>
                  <CalendarDays style={{ width: "14px", height: "14px", color: "#7C3AED" }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Weekly Schedule</span>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {selected.schedules && selected.schedules.length > 0 ? (
                    <ScheduleWeekGrid schedules={selected.schedules} />
                  ) : (
                    <div style={{ textAlign: "center", padding: "16px" }}>
                      <p style={{ fontSize: "12px", color: "#9CA3AF" }}>No schedule configured for this staff member.</p>
                      <p style={{ fontSize: "11px", color: "#D1D5DB", marginTop: "4px" }}>Edit the staff record to add weekly schedules.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Attendance log ────────────────────────────── */}
              <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Clock style={{ width: "14px", height: "14px", color: "#0D9488" }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Attendance Log</span>
                  <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: "#F0FDFA", color: "#0D9488", fontFamily: "'DM Mono', monospace" }}>{attendance.length}</span>
                </div>

                {attLoading ? (
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ height: "52px", borderRadius: "8px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
                    ))}
                  </div>
                ) : attendance.length === 0 ? (
                  <div style={{ padding: "32px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: "#9CA3AF" }}>No attendance records yet.</p>
                    <p style={{ fontSize: "11px", color: "#D1D5DB", marginTop: "4px" }}>Use the Clock In button to start tracking.</p>
                  </div>
                ) : (
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "400px", overflowY: "auto" }}>
                    {attendance.map((log) => <AttendanceRow key={log.id} log={log} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
