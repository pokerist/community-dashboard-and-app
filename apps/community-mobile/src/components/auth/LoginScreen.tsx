import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  Fingerprint,
  Mail,
  Lock,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { users } from "../../data/mockData";
import { Logo } from "../common/Logo";

interface LoginScreenProps {
  onLogin: (user: any) => void;
  onRegister: () => void;
}

export function LoginScreen({
  onLogin,
  onRegister,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showCredentials, setShowCredentials] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    setError("");

    // Check credentials against mock users
    const user = Object.values(users).find(
      (u) => u.email === email && u.password === password,
    );

    if (user) {
      onLogin(user);
    } else {
      setError("Invalid email or password");
    }
  };

  const handleBiometricLogin = () => {
    // Simulate biometric login - default to owner
    onLogin(users.owner);
  };

  return (
    <div className="h-screen w-full bg-gradient-to-b from-[#f8f9fa] to-white flex flex-col">
      {/* Header with Logo */}
      <div className="pt-16 pb-6 px-8 text-center">
        <Logo size="lg" variant="color" className="mb-6" />
      </div>

      {/* Video Banner */}
      <div className="px-8 pb-6">
        <div className="relative h-40 rounded-2xl overflow-hidden shadow-xl bg-[#2a3e35]">
          {/* Fallback gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#2a3e35] via-[#1f2e27] to-[#2a3e35]" />
          
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onError={() => {
              // Silently fail - fallback background already shown
            }}
            className="w-full h-full object-cover relative z-10"
          >
            <source
              src="https://cms-new.alkarmadevelopments.com/storage/uploads//2024/07/16/30-sec-Legacy-cutdown-01_1_uid_669663c496c03.mp4"
              type="video/mp4"
            />
          </video>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email or Phone</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
            <Input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmed.hassan@email.com"
              className="pl-12 h-14 rounded-2xl bg-white border border-[#E2E8F0] focus:border-[#2a3e35]"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pl-12 pr-12 h-14 rounded-2xl bg-white border border-[#E2E8F0] focus:border-[#2a3e35]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#2a3e35] transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) =>
                setRememberMe(checked as boolean)
              }
            />
            <label
              htmlFor="remember"
              className="text-sm text-[#64748B] cursor-pointer"
            >
              Remember me
            </label>
          </div>
          <button className="text-sm text-[#2a3e35] hover:text-[#1f2e27]">
            Forgot password?
          </button>
        </div>

        <Button
          onClick={handleLogin}
          className="w-full h-14 rounded-2xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
        >
          Sign In
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E2E8F0]"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#64748B]">
              Or
            </span>
          </div>
        </div>

        <Button
          onClick={handleBiometricLogin}
          variant="outline"
          className="w-full h-14 rounded-2xl border-[#E2E8F0] hover:bg-[#2a3e35]/5"
        >
          <Fingerprint className="w-5 h-5 mr-2" />
          Sign in with Biometrics
        </Button>
      </div>

      {/* Footer */}
      <div className="p-8 pb-4 text-center">
        <p className="text-[#64748B] text-sm mb-2">
          Don't have an account?{" "}
          <button
            onClick={onRegister}
            className="text-[#2a3e35] hover:text-[#1f2e27] font-medium"
          >
            Register Now
          </button>
        </p>
      </div>

      {/* Demo Credentials - After Register */}
      {showCredentials && (
        <div className="px-8 pb-6">
          <div className="p-4 bg-gradient-to-br from-[#c9a961]/10 to-[#2a3e35]/5 rounded-2xl border border-[#c9a961]/20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[#1E293B]">
                Demo Credentials
              </p>
              <button
                onClick={() => setShowCredentials(false)}
                className="text-xs text-[#64748B] hover:text-[#1E293B]"
              >
                Hide
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setEmail(users.owner.email);
                  setPassword(users.owner.password);
                }}
                className="w-full text-left p-3 bg-white rounded-xl hover:bg-[#2a3e35]/5 transition-colors border border-[#E2E8F0]"
              >
                <p className="text-[#1E293B] text-sm mb-1">
                  👤 Owner - Karma Gates (2 units)
                </p>
                <p className="text-[#64748B] text-xs">
                  {users.owner.email}
                </p>
              </button>
              <button
                onClick={() => {
                  setEmail(users.tenant.email);
                  setPassword(users.tenant.password);
                }}
                className="w-full text-left p-3 bg-white rounded-xl hover:bg-[#2a3e35]/5 transition-colors border border-[#E2E8F0]"
              >
                <p className="text-[#1E293B] text-sm mb-1">
                  🏠 Tenant - Karma
                </p>
                <p className="text-[#64748B] text-xs">
                  {users.tenant.email}
                </p>
              </button>
              <button
                onClick={() => {
                  setEmail(users.preOwner.email);
                  setPassword(users.preOwner.password);
                }}
                className="w-full text-left p-3 bg-white rounded-xl hover:bg-[#2a3e35]/5 transition-colors border border-[#E2E8F0]"
              >
                <p className="text-[#1E293B] text-sm mb-1">
                  🏗️ Not Delivered - owner
                </p>
                <p className="text-[#64748B] text-xs">
                  {users.preOwner.email}
                </p>
              </button>
              <button
                onClick={() => {
                  setEmail(users.contractor.email);
                  setPassword(users.contractor.password);
                }}
                className="w-full text-left p-3 bg-white rounded-xl hover:bg-[#2a3e35]/5 transition-colors border border-[#E2E8F0]"
              >
                <p className="text-[#1E293B] text-sm mb-1">
                  🎨 Interior Designer
                </p>
                <p className="text-[#64748B] text-xs">
                  {users.contractor.email}
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Powered by SSS */}
      <div className="px-8 pb-8 text-center">
        <div className="flex items-center justify-center space-x-1 text-xs text-[#64748B]">
          <span>Powered by</span>
          <span className="text-[#c9a961]">
            Smart Station Solutions
          </span>
        </div>
      </div>
    </div>
  );
}