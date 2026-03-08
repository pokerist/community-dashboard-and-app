import { FormEvent, useMemo, useState } from "react";
import { API_BASE_URL, apiClient, handleApiError, setAuthToken } from "../../lib/api-client";
import { toast } from "sonner";
import "./admin-login.css";

type AdminLoginPageProps = {
  onLoginSuccess: () => void;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* ── Illustration ─────────────────────────────────────────────── */
function LoginIllustration() {
  return (
    <div className="admin-login__illustration">
      <svg
        viewBox="0 0 520 310"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="admin-login__illustrationSvg"
      >
        <defs>
          <pattern id="illusGrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M 26 0 L 0 0 0 26" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="0.75" />
          </pattern>
          <linearGradient id="towerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.03)" />
          </linearGradient>
          <linearGradient id="accentBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#60A5FA" />
          </linearGradient>
          <filter id="cardGlow">
            <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#2563EB" floodOpacity="0.18" />
          </filter>
          <filter id="amberGlow">
            <feDropShadow dx="0" dy="2" stdDeviation="8" floodColor="#F5A623" floodOpacity="0.22" />
          </filter>
          <filter id="greenPulse">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#22C55E" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Grid background */}
        <rect width="520" height="310" fill="url(#illusGrid)" />

        {/* Ambient glow blob */}
        <ellipse cx="260" cy="155" rx="160" ry="110" fill="rgba(37,99,235,0.06)" />

        {/* ── Buildings ── */}
        {/* Left secondary building */}
        <rect x="68" y="155" width="76" height="115" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" rx="1" />
        {[170, 188, 206, 224, 242].map((y, i) => (
          <g key={i}>
            <rect x="80" y={y} width="11" height="9" fill="rgba(255,255,255,0.07)" rx="1" />
            <rect x="97" y={y} width="11" height="9" fill="rgba(255,255,255,0.05)" rx="1" />
            <rect x="114" y={y} width="11" height="9" fill="rgba(255,255,255,0.07)" rx="1" />
          </g>
        ))}

        {/* Center main tower */}
        <rect x="200" y="75" width="120" height="195" fill="url(#towerGrad)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" rx="1" />
        {/* Tower windows — some lit with indigo (occupied/active) */}
        {[90, 108, 126, 144, 162, 180, 198, 216, 234].map((y, i) => (
          <g key={i}>
            <rect x="212" y={y} width="12" height="10"
              fill={i % 4 === 0 || i % 3 === 0 ? "rgba(37,99,235,0.52)" : "rgba(255,255,255,0.06)"} rx="1" />
            <rect x="232" y={y} width="12" height="10"
              fill={i % 3 === 1 ? "rgba(37,99,235,0.38)" : "rgba(255,255,255,0.05)"} rx="1" />
            <rect x="252" y={y} width="12" height="10"
              fill={i % 5 === 0 || i % 4 === 2 ? "rgba(37,99,235,0.44)" : "rgba(255,255,255,0.06)"} rx="1" />
          </g>
        ))}
        {/* Tower top accent bar */}
        <rect x="200" y="73" width="120" height="3" fill="url(#accentBar)" rx="1" />

        {/* Right secondary building */}
        <rect x="376" y="132" width="76" height="138" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" rx="1" />
        {[148, 166, 184, 202, 220, 238].map((y, i) => (
          <g key={i}>
            <rect x="388" y={y} width="11" height="9" fill="rgba(255,255,255,0.06)" rx="1" />
            <rect x="405" y={y} width="11" height="9" fill="rgba(255,255,255,0.05)" rx="1" />
            <rect x="422" y={y} width="11" height="9" fill="rgba(255,255,255,0.07)" rx="1" />
          </g>
        ))}

        {/* Ground */}
        <line x1="0" y1="272" x2="520" y2="272" stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
        <ellipse cx="260" cy="275" rx="185" ry="10" fill="rgba(0,0,0,0.14)" />

        {/* ── Floating metric cards ── */}

        {/* OCCUPANCY — top left, indigo glow */}
        <g className="al-float-a" filter="url(#cardGlow)">
          <rect x="0" y="28" width="138" height="66" rx="4"
            fill="rgba(37,99,235,0.22)" stroke="rgba(37,99,235,0.42)" strokeWidth="1" />
          <text x="14" y="50" fontSize="8.5" fill="rgba(255,255,255,0.46)"
            letterSpacing="0.14em" fontFamily="'DM Mono',monospace" fontWeight="500">OCCUPANCY</text>
          <text x="14" y="78" fontSize="28" fontWeight="500"
            fill="rgba(255,255,255,0.95)" fontFamily="'DM Mono',monospace">94%</text>
          <circle cx="124" cy="44" r="5" fill="#22C55E" filter="url(#greenPulse)" />
          {/* Sparkline */}
          <polyline points="14,90 28,87 42,88 56,84 70,81 84,78 98,79 112,75"
            stroke="rgba(37,99,235,0.55)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* RESIDENTS — top right */}
        <g className="al-float-b">
          <rect x="382" y="18" width="138" height="66" rx="4"
            fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.11)" strokeWidth="1" />
          <text x="396" y="40" fontSize="8.5" fill="rgba(255,255,255,0.44)"
            letterSpacing="0.14em" fontFamily="'DM Mono',monospace" fontWeight="500">RESIDENTS</text>
          <text x="396" y="68" fontSize="28" fontWeight="500"
            fill="rgba(255,255,255,0.94)" fontFamily="'DM Mono',monospace">1,842</text>
        </g>

        {/* VISITORS — bottom left */}
        <g className="al-float-c">
          <rect x="0" y="196" width="138" height="66" rx="4"
            fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
          <text x="14" y="218" fontSize="8.5" fill="rgba(255,255,255,0.44)"
            letterSpacing="0.14em" fontFamily="'DM Mono',monospace" fontWeight="500">VISITORS NOW</text>
          <text x="14" y="246" fontSize="28" fontWeight="500"
            fill="rgba(255,255,255,0.94)" fontFamily="'DM Mono',monospace">47</text>
        </g>

        {/* OPEN TICKETS — bottom right, amber */}
        <g className="al-float-d" filter="url(#amberGlow)">
          <rect x="382" y="210" width="138" height="66" rx="4"
            fill="rgba(245,166,35,0.13)" stroke="rgba(245,166,35,0.32)" strokeWidth="1" />
          <text x="396" y="232" fontSize="8.5" fill="rgba(255,255,255,0.44)"
            letterSpacing="0.14em" fontFamily="'DM Mono',monospace" fontWeight="500">OPEN TICKETS</text>
          <text x="396" y="260" fontSize="28" fontWeight="500"
            fill="rgba(245,166,35,0.92)" fontFamily="'DM Mono',monospace">23</text>
        </g>

        {/* Connection lines from cards to tower */}
        <line x1="138" y1="61" x2="200" y2="148" stroke="rgba(37,99,235,0.22)" strokeWidth="0.75" strokeDasharray="4 6" />
        <line x1="382" y1="51" x2="320" y2="140" stroke="rgba(255,255,255,0.08)" strokeWidth="0.75" strokeDasharray="4 6" />
        <line x1="138" y1="229" x2="200" y2="222" stroke="rgba(255,255,255,0.07)" strokeWidth="0.75" strokeDasharray="4 6" />
        <line x1="382" y1="243" x2="320" y2="230" stroke="rgba(245,166,35,0.18)" strokeWidth="0.75" strokeDasharray="4 6" />

        {/* Connection dots */}
        <circle cx="138" cy="61" r="3" fill="rgba(37,99,235,0.65)" />
        <circle cx="382" cy="51" r="3" fill="rgba(255,255,255,0.22)" />
        <circle cx="138" cy="229" r="3" fill="rgba(255,255,255,0.18)" />
        <circle cx="382" cy="243" r="3" fill="rgba(245,166,35,0.55)" />

        {/* Decorative dots */}
        <circle cx="170" cy="45" r="2" fill="rgba(37,99,235,0.5)" />
        <circle cx="345" cy="62" r="1.5" fill="rgba(255,255,255,0.2)" />
        <circle cx="455" cy="140" r="2" fill="rgba(37,99,235,0.3)" />
        <circle cx="62" cy="185" r="1.5" fill="rgba(255,255,255,0.15)" />
      </svg>
    </div>
  );
}

/* ── Component ────────────────────────────────────────────────── */
export function AdminLoginPage({ onLoginSuccess }: AdminLoginPageProps) {
  const [email, setEmail] = useState("test@admin.com");
  const [password, setPassword] = useState("pass123");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiBase = useMemo(() => API_BASE_URL, []);
  const backendOffline = !!errorMessage && errorMessage.includes("Cannot reach backend");

  const fillSeedCredentials = () => {
    setEmail("test@admin.com");
    setPassword("pass123");
    setErrorMessage(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post("/auth/login", { email, password });
      const accessToken = res.data?.accessToken as string | undefined;
      const refreshToken = res.data?.refreshToken as string | undefined;

      if (!accessToken) {
        throw new Error("Login response did not include accessToken");
      }

      setAuthToken(accessToken);
      localStorage.setItem("auth_email", email);

      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }

      const payload = decodeJwtPayload(accessToken);
      const userId = payload?.sub;
      if (typeof userId === "string") {
        localStorage.setItem("auth_user_id", userId);
      }

      toast.success("Logged in", { description: `Connected to ${apiBase}` });
      onLoginSuccess();
    } catch (error) {
      const message = handleApiError(error);
      setErrorMessage(message);
      toast.error("Login failed", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login">
      {/* Noise texture overlay */}
      <div className="admin-login__noiseBg" />
      {/* Ambient glow blobs */}
      <div className="admin-login__glowA" />
      <div className="admin-login__glowB" />

      <div className="admin-login__shell">

        {/* ── LEFT PANEL ── */}
        <section className="admin-login__hero" aria-label="Platform overview">
          <div className="admin-login__heroTop">
            <div className="admin-login__badge">
              <span className="admin-login__badgePulse" />
              MG DEVELOPMENTS ADMIN
            </div>

            <h1 className="admin-login__heroTitle">
              Every unit. Every resident.<br />
              <em>One command center.</em>
            </h1>

            <p className="admin-login__heroText">
              Community operations don't clock out at 5 PM — and neither does this dashboard.
              Everything happening in your compound, live, in one place.
            </p>
          </div>

          <LoginIllustration />

          <div className="admin-login__heroBottom">
            <div className="admin-login__heroCard">
              <div className="admin-login__heroLabel">Backend Endpoint</div>
              <div className="admin-login__heroValue">{apiBase}</div>
            </div>

            <div className="admin-login__heroGrid">
              <button
                type="button"
                className="admin-login__heroMini admin-login__heroMini--button"
                onClick={fillSeedCredentials}
              >
                <div className="admin-login__heroLabel">Demo Admin</div>
                <div className="admin-login__heroValue">test@admin.com</div>
              </button>

              <div className="admin-login__heroMini">
                <div className="admin-login__heroLabel">Password</div>
                <div className="admin-login__heroValue">pass123</div>
              </div>
            </div>

            <div className="admin-login__featureList">
              <div className="admin-login__featureItem">
                <span className="admin-login__featureDot" />
                <span>Live backend auth with role-based access — you only see what you should.</span>
              </div>
              <div className="admin-login__featureItem">
                <span className="admin-login__featureDot" />
                <span>Operations, finance, service tickets, gate access, incidents — all wired up.</span>
              </div>
              <div className="admin-login__featureItem">
                <span className="admin-login__featureDot" />
                <span>Development seed account pre-loaded. Sign in and start exploring immediately.</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── RIGHT PANEL ── */}
        <section className="admin-login__panel">
          <div className="admin-login__card">
            <div className="admin-login__header">
              <div className="admin-login__chip">MG COMMAND CENTER</div>
              <h2 className="admin-login__title">Welcome back.</h2>
              <p className="admin-login__subtitle">
                Your community is waiting. Sign in with your admin credentials to get in.
              </p>
            </div>

            <div className="admin-login__demo">
              <div>
                <div className="admin-login__demoTitle">Dev Account Ready</div>
                <div className="admin-login__demoText">
                  Seed credentials are prefilled. Just hit sign in.
                </div>
              </div>
              <button
                type="button"
                className="admin-login__ghostBtn"
                onClick={fillSeedCredentials}
              >
                Autofill
              </button>
            </div>

            <form onSubmit={submit} className="admin-login__form">
              <div className="admin-login__field">
                <label htmlFor="admin-email" className="admin-login__label">
                  Email Address
                </label>
                <div className="admin-login__inputWrap">
                  <span className="admin-login__icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M4 6h16v12H4z" />
                      <path d="m4 7 8 6 8-6" />
                    </svg>
                  </span>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="admin-login__input"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <div className="admin-login__field">
                <div className="admin-login__labelRow">
                  <label htmlFor="admin-password" className="admin-login__label">
                    Password
                  </label>
                  <button
                    type="button"
                    className="admin-login__linkBtn"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="admin-login__inputWrap">
                  <span className="admin-login__icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M6 10V8a6 6 0 1 1 12 0v2" />
                      <rect x="4" y="10" width="16" height="10" rx="2" />
                    </svg>
                  </span>
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="admin-login__input"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="admin-login__alert admin-login__alert--error">
                  <div className="admin-login__alertIcon">!</div>
                  <div>{errorMessage}</div>
                </div>
              )}

              {backendOffline && (
                <div className="admin-login__alert admin-login__alert--info">
                  <div className="admin-login__alertContent">
                    <div className="admin-login__alertTitle">
                      Backend is offline (development setup)
                    </div>
                    <div>
                      1){" "}
                      <code>powershell -ExecutionPolicy Bypass -File scripts/dev-db-start.ps1</code>
                    </div>
                    <div>2) <code>npm run start:dev</code> from project root</div>
                    <div>3) API URL stays: <code>{apiBase}</code></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="admin-login__submit"
              >
                {isSubmitting && <span className="admin-login__spinner" />}
                <span>{isSubmitting ? "Signing in..." : "Access Command Center"}</span>
              </button>

              <div className="admin-login__meta">
                <div className="admin-login__metaTitle">Connected API</div>
                <div className="admin-login__metaValue">{apiBase}</div>
              </div>
            </form>
          </div>
        </section>

      </div>
    </div>
  );
}

export default AdminLoginPage;
