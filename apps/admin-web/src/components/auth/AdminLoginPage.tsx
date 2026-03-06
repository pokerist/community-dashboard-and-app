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
      <div className="admin-login__orb admin-login__orb--one" />
      <div className="admin-login__orb admin-login__orb--two" />
      <div className="admin-login__orb admin-login__orb--three" />

      <div className="admin-login__shell">
        <section className="admin-login__hero" aria-label="Platform overview">
          <div className="admin-login__heroTop">
            <div className="admin-login__badge">ALKARMA ADMIN</div>
            <h1 className="admin-login__heroTitle">
              Community operations in one control panel
            </h1>
            <p className="admin-login__heroText">
              Manage residents, units, service requests, complaints, invoices and access activity from the current backend.
            </p>

            <div className="admin-login__featureList">
              <div className="admin-login__featureItem">
                <span className="admin-login__featureDot" />
                <span>Live backend authentication and role-based access control</span>
              </div>
              <div className="admin-login__featureItem">
                <span className="admin-login__featureDot" />
                <span>Admin modules for operations, finance, service and incidents</span>
              </div>
              <div className="admin-login__featureItem">
                <span className="admin-login__featureDot" />
                <span>Seeded local admin account ready for development testing</span>
              </div>
            </div>
          </div>

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
          </div>
        </section>

        <section className="admin-login__panel">
          <div className="admin-login__card">
            <div className="admin-login__header">
              <div className="admin-login__chip">SIGN IN</div>
              <h2 className="admin-login__title">Welcome back</h2>
              <p className="admin-login__subtitle">
                Sign in to the admin dashboard using your account credentials.
              </p>
            </div>

            <div className="admin-login__demo">
              <div>
                <div className="admin-login__demoTitle">Development account</div>
                <div className="admin-login__demoText">
                  Seeded credentials are prefilled and ready to use.
                </div>
              </div>
              <button
                type="button"
                className="admin-login__ghostBtn"
                onClick={fillSeedCredentials}
              >
                Fill Demo
              </button>
            </div>

            <form onSubmit={submit} className="admin-login__form">
              <div className="admin-login__field">
                <label htmlFor="admin-email" className="admin-login__label">
                  Email Address
                </label>
                <div className="admin-login__inputWrap">
                  <span className="admin-login__icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
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
                      Backend is not running (development setup)
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
                <span>{isSubmitting ? "Signing in..." : "Sign in to Dashboard"}</span>
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
