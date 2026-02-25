import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp";
import { Eye, EyeOff, Upload, CheckCircle, AlertCircle, Shield } from "lucide-react";
import { Logo } from "../common/Logo";
import { toast } from "sonner@2.0.3";

interface RegisterScreenProps {
  onRegister: (userData: any) => void;
  onBack: () => void;
}

export function RegisterScreen({ onRegister, onBack }: RegisterScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [showAgreements, setShowAgreements] = useState(false);
  const [otp, setOtp] = useState("123456");
  const [isVerifying, setIsVerifying] = useState(false);

  // Form fields - Pre-filled for demo
  const [fullName, setFullName] = useState("Ahmed Mohamed Ali");
  const [email, setEmail] = useState("ahmed.mohamed@example.com");
  const [phone, setPhone] = useState("+20 111 222 3333");
  const [password, setPassword] = useState("Password123!");
  const [confirmPassword, setConfirmPassword] = useState("Password123!");
  const [uploadedId, setUploadedId] = useState<File | null>(
    new File([""], "national_id.jpg", { type: "image/jpeg" })
  );
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Mock registered phone numbers (in real app, this would be an API call)
  const registeredPhones = ["+20 111 222 3333", "+20 100 555 7777", "+20 122 888 9999"];

  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedId(e.target.files[0]);
      toast.success("ID card uploaded successfully");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!uploadedId) {
      toast.error("Please upload your ID card");
      return;
    }

    if (!agreedToTerms) {
      toast.error("Please agree to the community agreements");
      return;
    }

    // Check if phone is registered
    if (!registeredPhones.includes(phone)) {
      toast.error("Phone number not found in our records", {
        description: "Please use the phone number registered with Al Karma"
      });
      return;
    }

    // Phone verified, send OTP
    toast.success("Phone number verified!", {
      description: `OTP sent to ${phone}`
    });
    setShowOTP(true);
  };

  const handleOTPVerify = () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit OTP");
      return;
    }

    setIsVerifying(true);

    // Simulate OTP verification
    setTimeout(() => {
      if (otp === "123456") {
        toast.success("Account created successfully!", {
          description: "Welcome to Al Karma Community"
        });

        // Create user account
        const userData = {
          id: `user-${Date.now()}`,
          name: fullName,
          email: email,
          phone: phone,
          accountType: "Delivered Owner",
          unit: "A-101",
          compound: "Al Karma 1",
          units: [
            {
              id: "unit-1",
              number: "A-101",
              compound: "Al Karma 1",
              status: "Delivered",
              hasSmartHome: true,
              hasCameras: true
            }
          ]
        };

        onRegister(userData);
      } else {
        toast.error("Invalid OTP", {
          description: "Please check the code and try again"
        });
        setIsVerifying(false);
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a3e35] to-[#1a2821] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Logo variant="light" size="lg" />
          <p className="text-white/80 mt-2">Create Your Account</p>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <Label htmlFor="fullName" className="text-[#1E293B]">Full Name *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ahmed Mohamed"
                className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-[#E2E8F0]"
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-[#1E293B]">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ahmed@example.com"
                className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-[#E2E8F0]"
              />
            </div>

            {/* Phone Number */}
            <div>
              <Label htmlFor="phone" className="text-[#1E293B]">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+20 111 222 3333"
                className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-[#E2E8F0]"
              />
              <p className="text-xs text-[#64748B] mt-1">
                Use the phone number registered with Al Karma
              </p>
            </div>

            {/* Password */}
            <div>
              <Label htmlFor="password" className="text-[#1E293B]">Password *</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="h-12 rounded-xl bg-[#F9FAFB] border-[#E2E8F0] pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <Label htmlFor="confirmPassword" className="text-[#1E293B]">Confirm Password *</Label>
              <div className="relative mt-2">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="h-12 rounded-xl bg-[#F9FAFB] border-[#E2E8F0] pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B]"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* ID Upload */}
            <div>
              <Label className="text-[#1E293B]">National ID Card *</Label>
              <p className="text-xs text-[#64748B] mt-1 mb-2">
                Upload a clear photo of your national ID card
              </p>
              <label htmlFor="id-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-[#E2E8F0] rounded-xl p-4 text-center hover:border-[#2a3e35] transition-colors bg-[#F9FAFB]">
                  {uploadedId ? (
                    <div className="flex items-center justify-center space-x-2 text-[#10B981]">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm">{uploadedId.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-[#64748B] mx-auto mb-2" />
                      <p className="text-sm text-[#1E293B]">Click to upload ID card</p>
                      <p className="text-xs text-[#64748B] mt-1">JPG, PNG (Max 5MB)</p>
                    </>
                  )}
                </div>
              </label>
              <input
                id="id-upload"
                type="file"
                accept="image/*"
                onChange={handleIdUpload}
                className="hidden"
              />
            </div>

            {/* Community Agreements */}
            <div className="flex items-start space-x-3 p-4 bg-[#F9FAFB] rounded-xl">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label htmlFor="terms" className="text-sm text-[#1E293B] cursor-pointer">
                  I agree to the{" "}
                  <button
                    type="button"
                    onClick={() => setShowAgreements(true)}
                    className="text-[#2a3e35] underline hover:text-[#c9a961]"
                  >
                    Community Agreements & Regulations
                  </button>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#2a3e35] to-[#1a2821] hover:opacity-90 text-white"
            >
              Create Account
            </Button>

            {/* Back to Login */}
            <button
              type="button"
              onClick={onBack}
              className="w-full text-center text-sm text-[#64748B] hover:text-[#2a3e35]"
            >
              Already have an account? <span className="text-[#2a3e35] underline">Sign In</span>
            </button>
          </form>
        </div>

        {/* Hint */}
        <div className="mt-6 text-center">
          <p className="text-white/60 text-xs">
            Demo: Use phone +20 111 222 3333 | OTP: 123456
          </p>
        </div>
      </div>

      {/* OTP Dialog */}
      <Dialog open={showOTP} onOpenChange={setShowOTP}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="w-6 h-6 text-[#2a3e35]" />
              <span>Verify Your Phone</span>
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to {phone}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="flex justify-center mb-6">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-12 h-12 text-lg" />
                  <InputOTPSlot index={1} className="w-12 h-12 text-lg" />
                  <InputOTPSlot index={2} className="w-12 h-12 text-lg" />
                  <InputOTPSlot index={3} className="w-12 h-12 text-lg" />
                  <InputOTPSlot index={4} className="w-12 h-12 text-lg" />
                  <InputOTPSlot index={5} className="w-12 h-12 text-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleOTPVerify}
              disabled={isVerifying || otp.length !== 6}
              className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
            >
              {isVerifying ? "Verifying..." : "Verify & Create Account"}
            </Button>

            <button
              type="button"
              onClick={() => toast.success("OTP resent successfully")}
              className="w-full text-center text-sm text-[#64748B] hover:text-[#2a3e35] mt-4"
            >
              Didn't receive code? <span className="text-[#2a3e35] underline">Resend</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Community Agreements Dialog */}
      <Dialog open={showAgreements} onOpenChange={setShowAgreements}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-[#1E293B]">
              <Shield className="w-6 h-6 text-[#c9a961]" />
              <span>Al Karma Community Agreements</span>
            </DialogTitle>
            <DialogDescription>
              Please review the following community regulations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* General Conduct */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2">1. General Conduct</h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• احترام خصوصية وممتلكات الجيران</li>
                <li>• الحفاظ على نظافة المناطق العامة</li>
                <li>• عدم إحداث ضوضاء بعد الساعة 10 مساءً</li>
              </ul>
            </div>

            {/* Parking Rules */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2">2. Parking Regulations</h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• استخدام مواقف السيارات المخصصة فقط</li>
                <li>• عدم إيقاف السيارات في الممرات الرئيسية</li>
                <li>• تسجيل جميع المركبات لدى الإدارة</li>
              </ul>
            </div>

            {/* Pets Policy */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2">3. Pets Policy</h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• الحيوانات الأليفة مسموح بها بشروط معينة</li>
                <li>• يجب تسجيل الحيوانات الأليفة</li>
                <li>• التنظيف خلف الحيوانات الأليفة إلزامي</li>
              </ul>
            </div>

            {/* Renovations */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2">4. Renovations & Modifications</h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• يجب الحصول على موافقة مسبقة للتجديدات</li>
                <li>• أوقات العمل: السبت-الخميس 8ص-6م</li>
                <li>• ممنوع تعديل الواجهات الخارجية</li>
              </ul>
            </div>

            {/* Safety & Security */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2">5. Safety & Security</h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• الالتزام بإجراءات الأمن والسلامة</li>
                <li>• عدم السماح بدخول غرباء بدون إذن</li>
                <li>• الإبلاغ عن أي نشاط مشبوه</li>
              </ul>
            </div>

            {/* Fees & Payments */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2">6. Fees & Payments</h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• سداد رسوم الصيانة في موعدها</li>
                <li>• عدم التأخير في سداد المستحقات</li>
                <li>• غرامات على التأخير في السداد</li>
              </ul>
            </div>

            {/* Violations */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <h4 className="text-sm text-red-700 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                7. Violations & Penalties
              </h4>
              <ul className="text-xs text-red-600 space-y-1 mr-6" dir="rtl">
                <li>• مخالفة القواعد قد تؤدي إلى غرامات مالية</li>
                <li>• المخالفات المتكررة قد تؤدي إلى إجراءات قانونية</li>
                <li>• حق الإدارة في إلغاء العضوية عند ��لمخالفات الجسيمة</li>
              </ul>
            </div>

            {/* Action Button */}
            <Button
              onClick={() => {
                setShowAgreements(false);
                setAgreedToTerms(true);
                toast.success("Thank you for reviewing the agreements");
              }}
              className="w-full h-11 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
            >
              I Understand & Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
