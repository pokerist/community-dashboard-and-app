import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Calendar, Clock, User, Phone, Package, Car, Share2, Download, History, CheckCircle, Shield, Users, HardHat, Upload, AlertCircle } from "lucide-react";
import { qrHistory } from "../../data/mockData";
import QRCode from "react-qr-code";
import { toast } from "sonner@2.0.3";

interface QRCodesScreenProps {
  user: any;
  onBack?: () => void;
}

export function QRCodesScreen({ user, onBack }: QRCodesScreenProps) {
  const [activeTab, setActiveTab] = useState("visitors");
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQRData] = useState<any>(null);

  // Visitor Form State
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorDate, setVisitorDate] = useState("");
  const [visitorTime, setVisitorTime] = useState("");
  const [visitorPurpose, setVisitorPurpose] = useState("");

  // Delivery Form State
  const [deliveryCompany, setDeliveryCompany] = useState("");

  // Ride Form State
  const [rideService, setRideService] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPlate, setDriverPlate] = useState("");

  // Blue Collar Form State
  const [numberOfWorkers, setNumberOfWorkers] = useState("");
  const [workType, setWorkType] = useState("");
  const [expectedDuration, setExpectedDuration] = useState("");
  const [uploadedIds, setUploadedIds] = useState<File[]>([]);
  const [showRegulations, setShowRegulations] = useState(false);

  const generateVisitorQR = () => {
    const data = {
      type: "VISITOR",
      id: `QR-V-${Date.now()}`,
      name: visitorName,
      phone: visitorPhone,
      date: visitorDate,
      time: visitorTime,
      purpose: visitorPurpose,
      unit: user.unit,
      resident: user.name
    };
    setQRData(data);
    setShowQR(true);
  };

  const generateDeliveryQR = () => {
    const data = {
      type: "DELIVERY",
      id: `QR-D-${Date.now()}`,
      company: deliveryCompany,
      unit: user.unit,
      resident: user.name
    };
    setQRData(data);
    setShowQR(true);
  };

  const generateRideQR = () => {
    const data = {
      type: "RIDE",
      id: `QR-R-${Date.now()}`,
      service: rideService,
      driver: driverName,
      plate: driverPlate,
      unit: user.unit,
      resident: user.name
    };
    setQRData(data);
    setShowQR(true);
  };

  const handleBlueCollarSubmit = () => {
    // Show regulations first
    setShowRegulations(true);
  };

  const generateBlueCollarPermit = () => {
    const data = {
      type: "BLUE_COLLAR",
      id: `QR-BC-${Date.now()}`,
      numberOfWorkers: numberOfWorkers,
      workType: workType,
      duration: expectedDuration,
      idsUploaded: uploadedIds.length,
      unit: user.unit,
      resident: user.name
    };
    setQRData(data);
    setShowRegulations(false);
    setShowQR(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setUploadedIds([...uploadedIds, ...filesArray]);
      toast.success(`${filesArray.length} ID(s) uploaded successfully`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="text-[#2a3e35] mb-4">
            ← Back
          </button>
        )}
        <h2 className="text-[#1E293B] mb-2">QR Codes</h2>
        <p className="text-[#64748B]">Generate and manage access codes</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 mt-6">
        <TabsList className="grid w-full grid-cols-4 bg-white rounded-2xl p-2 shadow-sm h-auto">
          <TabsTrigger 
            value="visitors" 
            className="rounded-xl data-[state=active]:bg-[#2a3e35] data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex flex-col sm:flex-row items-center gap-1 py-2.5 h-auto"
          >
            <Users className="w-4 h-4" />
            <span className="text-[10px] sm:text-xs leading-tight">Visitors</span>
          </TabsTrigger>
          <TabsTrigger 
            value="deliveries" 
            className="rounded-xl data-[state=active]:bg-[#2a3e35] data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex flex-col sm:flex-row items-center gap-1 py-2.5 h-auto"
          >
            <Package className="w-4 h-4" />
            <span className="text-[10px] sm:text-xs leading-tight">Deliveries</span>
          </TabsTrigger>
          <TabsTrigger 
            value="rideshare" 
            className="rounded-xl data-[state=active]:bg-[#2a3e35] data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex flex-col sm:flex-row items-center gap-1 py-2.5 h-auto"
          >
            <Car className="w-4 h-4" />
            <span className="text-[10px] sm:text-xs leading-tight">Ride</span>
          </TabsTrigger>
          <TabsTrigger 
            value="workers" 
            className="rounded-xl data-[state=active]:bg-[#2a3e35] data-[state=active]:text-white data-[state=active]:shadow-md transition-all flex flex-col sm:flex-row items-center gap-1 py-2.5 h-auto"
          >
            <HardHat className="w-4 h-4" />
            <span className="text-[10px] sm:text-xs leading-tight">Blue Collars</span>
          </TabsTrigger>
        </TabsList>

        {/* Visitors Tab */}
        <TabsContent value="visitors" className="mt-6 space-y-4">
          <Card className="p-6 bg-white rounded-2xl shadow-sm border-0">
            <h3 className="text-[#1E293B] mb-4">Visitor Information</h3>
            <div className="space-y-4">
              <div>
                <Label>Visitor Name</Label>
                <div className="relative mt-2">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                  <Input
                    value={visitorName}
                    onChange={(e) => setVisitorName(e.target.value)}
                    placeholder="Mohamed Ibrahim"
                    className="pl-12 h-12 rounded-xl bg-[#F9FAFB] border-0"
                  />
                </div>
              </div>

              <div>
                <Label>Phone Number</Label>
                <div className="relative mt-2">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                  <Input
                    value={visitorPhone}
                    onChange={(e) => setVisitorPhone(e.target.value)}
                    placeholder="+20 111 222 3333"
                    className="pl-12 h-12 rounded-xl bg-[#F9FAFB] border-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <div className="relative mt-2">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                    <Input
                      type="date"
                      value={visitorDate}
                      onChange={(e) => setVisitorDate(e.target.value)}
                      className="pl-12 h-12 rounded-xl bg-[#F9FAFB] border-0"
                    />
                  </div>
                </div>
                <div>
                  <Label>Time</Label>
                  <div className="relative mt-2">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                    <Input
                      type="time"
                      value={visitorTime}
                      onChange={(e) => setVisitorTime(e.target.value)}
                      className="pl-12 h-12 rounded-xl bg-[#F9FAFB] border-0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Purpose of Visit</Label>
                <Input
                  value={visitorPurpose}
                  onChange={(e) => setVisitorPurpose(e.target.value)}
                  placeholder="Family visit, business, etc."
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <Button
                onClick={generateVisitorQR}
                className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                disabled={!visitorName || !visitorPhone || !visitorDate || !visitorTime}
              >
                Generate QR Code
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Deliveries Tab */}
        <TabsContent value="deliveries" className="mt-6 space-y-4">
          <Card className="p-6 bg-white rounded-2xl shadow-sm border-0">
            <h3 className="text-[#1E293B] mb-4">Delivery Information</h3>
            <div className="space-y-4">
              <div>
                <Label>Delivery Service</Label>
                <Select value={deliveryCompany} onValueChange={setDeliveryCompany}>
                  <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Food Delivery Apps */}
                    <SelectItem value="talabat">Talabat</SelectItem>
                    <SelectItem value="elmenus">Elmenus</SelectItem>
                    <SelectItem value="uber-eats">Uber Eats</SelectItem>
                    <SelectItem value="noon-food">Noon Food</SelectItem>
                    <SelectItem value="carriage">Carriage</SelectItem>
                    
                    {/* Popular Restaurants */}
                    <SelectItem value="mcdonalds">McDonald's</SelectItem>
                    <SelectItem value="kfc">KFC</SelectItem>
                    <SelectItem value="pizza-hut">Pizza Hut</SelectItem>
                    <SelectItem value="dominos">Domino's Pizza</SelectItem>
                    <SelectItem value="papa-johns">Papa John's</SelectItem>
                    <SelectItem value="burger-king">Burger King</SelectItem>
                    <SelectItem value="hardees">Hardee's</SelectItem>
                    <SelectItem value="chilis">Chili's</SelectItem>
                    <SelectItem value="buffalo-wild-wings">Buffalo Wild Wings</SelectItem>
                    <SelectItem value="cook-door">Cook Door</SelectItem>
                    
                    {/* Courier Services */}
                    <SelectItem value="aramex">Aramex</SelectItem>
                    <SelectItem value="dhl">DHL</SelectItem>
                    <SelectItem value="fedex">FedEx</SelectItem>
                    <SelectItem value="bosta">Bosta</SelectItem>
                    <SelectItem value="egypt-post">Egypt Post</SelectItem>
                    <SelectItem value="smsa">SMSA Express</SelectItem>
                    
                    {/* Grocery & Other */}
                    <SelectItem value="spinneys">Spinneys</SelectItem>
                    <SelectItem value="carrefour">Carrefour</SelectItem>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="jumia">Jumia</SelectItem>
                    <SelectItem value="noon">Noon</SelectItem>
                    
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={generateDeliveryQR}
                className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                disabled={!deliveryCompany}
              >
                Send Access Permit to Security
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Ride Tab */}
        <TabsContent value="rideshare" className="mt-6 space-y-4">
          <Card className="p-6 bg-white rounded-2xl shadow-sm border-0">
            <h3 className="text-[#1E293B] mb-4">Ride Information</h3>
            <div className="space-y-4">
              <div>
                <Label>Service</Label>
                <Select value={rideService} onValueChange={setRideService}>
                  <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uber">Uber</SelectItem>
                    <SelectItem value="careem">Careem</SelectItem>
                    <SelectItem value="didi">DiDi</SelectItem>
                    <SelectItem value="bolt">Bolt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Driver Name (Optional)</Label>
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver's name"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Plate Number (Optional)</Label>
                <Input
                  value={driverPlate}
                  onChange={(e) => setDriverPlate(e.target.value)}
                  placeholder="ABC 1234"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <Button
                onClick={generateRideQR}
                className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                disabled={!rideService}
              >
                Send Access Permit to Security
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Blue Collar Workers Tab */}
        <TabsContent value="workers" className="mt-6 space-y-4">
          <Card className="p-6 bg-white rounded-2xl shadow-sm border-0">
            <div className="flex items-start space-x-3 mb-4 p-3 bg-[#c9a961]/10 rounded-xl">
              <AlertCircle className="w-5 h-5 text-[#c9a961] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-[#1E293B] mb-1">Worker Registration</p>
                <p className="text-xs text-[#64748B]">
                  All workers must have valid IDs and agree to compound work regulations
                </p>
              </div>
            </div>

            <h3 className="text-[#1E293B] mb-4">Worker Information</h3>
            <div className="space-y-4">
              <div>
                <Label>Number of Workers *</Label>
                <Input
                  type="number"
                  min="1"
                  value={numberOfWorkers}
                  onChange={(e) => setNumberOfWorkers(e.target.value)}
                  placeholder="Enter number of workers"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Type of Work *</Label>
                <Select value={workType} onValueChange={setWorkType}>
                  <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="construction">Construction</SelectItem>
                    <SelectItem value="renovation">Renovation</SelectItem>
                    <SelectItem value="electrical">Electrical Work</SelectItem>
                    <SelectItem value="plumbing">Plumbing</SelectItem>
                    <SelectItem value="painting">Painting</SelectItem>
                    <SelectItem value="carpentry">Carpentry</SelectItem>
                    <SelectItem value="hvac">HVAC Installation</SelectItem>
                    <SelectItem value="landscaping">Landscaping</SelectItem>
                    <SelectItem value="cleaning">Deep Cleaning</SelectItem>
                    <SelectItem value="moving">Moving/Relocation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Expected Duration</Label>
                <Select value={expectedDuration} onValueChange={setExpectedDuration}>
                  <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-day">1 Day</SelectItem>
                    <SelectItem value="2-3-days">2-3 Days</SelectItem>
                    <SelectItem value="1-week">1 Week</SelectItem>
                    <SelectItem value="2-weeks">2 Weeks</SelectItem>
                    <SelectItem value="1-month">1 Month</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Upload Worker IDs *</Label>
                <p className="text-xs text-[#64748B] mt-1 mb-2">
                  Upload {numberOfWorkers || "all"} worker ID card(s) - Front and back required
                </p>
                <div className="mt-2">
                  <label htmlFor="id-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-[#E2E8F0] rounded-xl p-6 text-center hover:border-[#2a3e35] transition-colors bg-[#F9FAFB]">
                      <Upload className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                      <p className="text-sm text-[#1E293B] mb-1">Click to upload ID cards</p>
                      <p className="text-xs text-[#64748B]">
                        {uploadedIds.length > 0 
                          ? `${uploadedIds.length} file(s) uploaded` 
                          : "JPG, PNG or PDF (Max 5MB each)"}
                      </p>
                    </div>
                  </label>
                  <input
                    id="id-upload"
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                {uploadedIds.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadedIds.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#E2E8F0]">
                        <span className="text-xs text-[#64748B] truncate flex-1">{file.name}</span>
                        <button
                          onClick={() => {
                            setUploadedIds(uploadedIds.filter((_, i) => i !== index));
                            toast.success("File removed");
                          }}
                          className="text-xs text-red-500 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={handleBlueCollarSubmit}
                className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                disabled={!numberOfWorkers || !workType || uploadedIds.length === 0}
              >
                Review Work Regulations & Submit
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* QR History */}
      <div className="px-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#1E293B]">Recent QR Codes</h3>
          <button className="text-sm text-[#2a3e35]">View All</button>
        </div>
        <div className="space-y-3">
          {qrHistory.slice(0, 3).map((qr) => (
            <Card key={qr.id} className="p-4 bg-white rounded-2xl shadow-sm border-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm text-[#2a3e35]">{qr.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      qr.status === "Used" 
                        ? "bg-[#10B981]/10 text-[#10B981]" 
                        : "bg-[#64748B]/10 text-[#64748B]"
                    }`}>
                      {qr.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#64748B]">
                    {qr.type} • {qr.date} {qr.time && `• ${qr.time}`}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Work Regulations Dialog */}
      <Dialog open={showRegulations} onOpenChange={setShowRegulations}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-[#1E293B]">
              <Shield className="w-6 h-6 text-[#c9a961]" />
              <span>Al Karma Compound Work Regulations</span>
            </DialogTitle>
            <DialogDescription>
              Please review and accept the following regulations before proceeding
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Working Hours */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-[#2a3e35]" />
                Permitted Working Hours
              </h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• السبت - الخميس: 8:00 صباحاً - 6:00 مساءً</li>
                <li>• الجمعة: ممنوع العمل</li>
                <li>• يُمنع إصدار أي ضوضاء بعد الساعة 6:00 مساءً</li>
              </ul>
            </div>

            {/* Official Holidays */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2 flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-[#2a3e35]" />
                Official Holidays - No Work Allowed
              </h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• عيد الفطر المبارك (3 أيام)</li>
                <li>• عيد الأضحى المبارك (4 أيام)</li>
                <li>• رأس السنة الميلادية (1 يناير)</li>
                <li>• ثورة 25 يناير (25 يناير)</li>
                <li>• عيد تحرير سيناء (25 أبريل)</li>
                <li>• عيد العمال (1 مايو)</li>
                <li>• ثورة 30 يونيو (30 يونيو)</li>
                <li>• ثورة 23 يوليو (23 يوليو)</li>
              </ul>
            </div>

            {/* Safety Rules */}
            <div className="p-4 bg-[#F9FAFB] rounded-xl">
              <h4 className="text-sm text-[#1E293B] mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-2 text-[#2a3e35]" />
                Safety & Conduct Rules
              </h4>
              <ul className="text-xs text-[#64748B] space-y-1 mr-6" dir="rtl">
                <li>• يجب على جميع العمال ارتداء بطاقات التعريف المرئية</li>
                <li>• استخدام معدات السلامة إلزامي (خوذة، أحذية أمان)</li>
                <li>• التدخين محظور في الأماكن المغلقة</li>
                <li>• يجب الحفاظ على نظافة موقع العمل</li>
                <li>• احترام خصوصية السكان وممتلكاتهم</li>
                <li>• عدم استخدام المصاعد العامة لنقل مواد البناء</li>
              </ul>
            </div>

            {/* Violations & Fines */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <h4 className="text-sm text-red-700 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Violations & Penalties
              </h4>
              <ul className="text-xs text-red-600 space-y-1 mr-6" dir="rtl">
                <li>• العمل في أوقات غير مصرح بها: 500 جنيه</li>
                <li>• العمل في أيام العطلات الرسمية: 1000 جنيه</li>
                <li>• عدم ارتداء بطاقات التعريف: 200 جنيه</li>
                <li>• إحداث ضوضاء زائدة: 300 جنيه</li>
                <li>• عدم الالتزام بقواعد السلامة: 500 جنيه</li>
                <li>• المخالفة المتكررة قد تؤدي إلى إلغاء التصريح نهائياً</li>
              </ul>
            </div>

            {/* Responsibility Statement */}
            <div className="p-4 bg-[#c9a961]/10 border border-[#c9a961]/30 rounded-xl">
              <p className="text-xs text-[#1E293B] leading-relaxed" dir="rtl">
                <strong>إقرار المسؤولية:</strong> بالموافقة على هذه اللوائح، أتحمل كامل المسؤولية عن جميع العمال المسجلين تحت اسمي. 
                أتعهد بالالتزام بجميع القواعد المذكورة أعلاه وسداد أي غرامات قد تنتج عن مخالفات العمال.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-2">
              <Button
                type="button"
                onClick={() => setShowRegulations(false)}
                className="flex-1 h-11 rounded-xl bg-[#F9FAFB] text-[#1E293B] hover:bg-[#E2E8F0]"
              >
                إلغاء
              </Button>
              <Button
                onClick={generateBlueCollarPermit}
                className="flex-1 h-11 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
              >
                أوافق وأواصل
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          {qrData && (
            <>
              {qrData.type === "VISITOR" ? (
                // Visitor QR Code - Show QR with share options
                <>
                  <DialogHeader>
                    <DialogTitle>Visitor QR Code Generated</DialogTitle>
                    <DialogDescription>
                      Share this QR code with your visitor to scan at the gate
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center space-y-4">
                    <div className="bg-white p-4 rounded-2xl border-2 border-[#E2E8F0]">
                      <QRCode value={JSON.stringify(qrData)} size={200} />
                    </div>
                    <div className="w-full bg-[#F9FAFB] rounded-xl p-4 text-sm">
                      <p className="text-[#64748B] mb-1">ID: <span className="text-[#1E293B]">{qrData.id}</span></p>
                      <p className="text-[#64748B] mb-1">Visitor: <span className="text-[#1E293B]">{qrData.name}</span></p>
                      <p className="text-[#64748B] mb-1">Date: <span className="text-[#1E293B]">{qrData.date} at {qrData.time}</span></p>
                      <p className="text-[#64748B]">Unit: <span className="text-[#1E293B]">{qrData.unit}</span></p>
                    </div>
                    <div className="flex space-x-2 w-full">
                      <Button 
                        variant="outline" 
                        className="flex-1 rounded-xl border-[#2a3e35] text-[#2a3e35] hover:bg-[#2a3e35] hover:text-white"
                        onClick={() => {
                          toast.success("QR code copied to clipboard");
                        }}
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 rounded-xl border-[#2a3e35] text-[#2a3e35] hover:bg-[#2a3e35] hover:text-white"
                        onClick={() => {
                          toast.success("QR code saved");
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                    </div>
                  </div>
                </>
              ) : qrData.type === "BLUE_COLLAR" ? (
                // Blue Collar - Show confirmation with regulations reference
                <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-6 h-6 text-[#10B981]" />
                  <span>Worker Permit Approved</span>
                </DialogTitle>
                <DialogDescription>
                  Worker access permit has been sent to compound security
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4 py-4">
                {/* Success Icon */}
                <div className="w-24 h-24 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                  <HardHat className="w-12 h-12 text-[#10B981]" />
                </div>

                {/* Permit Details */}
                <div className="w-full bg-[#F9FAFB] rounded-xl p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">Permit ID:</span>
                    <span className="text-[#1E293B] font-mono">{qrData.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Number of Workers:</span>
                    <span className="text-[#1E293B]">{qrData.numberOfWorkers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Work Type:</span>
                    <span className="text-[#1E293B] capitalize">{qrData.workType}</span>
                  </div>
                  {qrData.duration && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Duration:</span>
                      <span className="text-[#1E293B]">{qrData.duration}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Unit:</span>
                    <span className="text-[#1E293B]">{qrData.unit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">IDs Verified:</span>
                    <span className="text-[#10B981]">{qrData.idsUploaded} ✓</span>
                  </div>
                </div>

                {/* Regulations Reminder */}
                <div className="w-full bg-[#c9a961]/10 border border-[#c9a961]/30 rounded-xl p-4">
                  <p className="text-sm text-[#1E293B] leading-relaxed" dir="rtl">
                    <span className="text-[#c9a961] font-medium">تذكير مهم:</span><br />
                    أنت مسؤول ��ن التزام العمال بلوائح العمل في الكمبوند. 
                    العمل المسموح: السبت-الخميس 8ص-6م فقط.
                  </p>
                </div>

                {/* Action Button */}
                <Button 
                  onClick={() => {
                    setShowQR(false);
                    toast.success("Workers can now access the compound");
                  }}
                  className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                >
                  Understood
                </Button>
              </div>
            </>
              ) : (
                // Delivery/Ride - Show confirmation only
                <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-6 h-6 text-[#10B981]" />
                  <span>Access Permit Sent</span>
                </DialogTitle>
                <DialogDescription>
                  The access permit has been sent directly to compound security
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center space-y-4 py-4">
                {/* Success Icon */}
                <div className="w-24 h-24 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                  <Shield className="w-12 h-12 text-[#10B981]" />
                </div>

                {/* Permit Details */}
                <div className="w-full bg-[#F9FAFB] rounded-xl p-4 text-sm space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="text-[#64748B]">Permit ID:</span>
                    <span className="text-[#1E293B] font-mono">{qrData.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Type:</span>
                    <span className="text-[#1E293B]">{qrData.type === "DELIVERY" ? "Delivery" : "Ride"}</span>
                  </div>
                  {qrData.type === "DELIVERY" && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Company:</span>
                      <span className="text-[#1E293B] capitalize">{qrData.company}</span>
                    </div>
                  )}
                  {qrData.type === "RIDE" && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Service:</span>
                      <span className="text-[#1E293B] capitalize">{qrData.service}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Unit:</span>
                    <span className="text-[#1E293B]">{qrData.unit}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Status:</span>
                    <span className="px-2 py-1 rounded-full text-xs bg-[#10B981]/10 text-[#10B981]">
                      Sent to Security
                    </span>
                  </div>
                </div>

                {/* Information Box */}
                <div className="w-full bg-[#2a3e35]/5 border border-[#2a3e35]/20 rounded-xl p-4">
                  <p className="text-sm text-[#64748B] leading-relaxed">
                    <span className="text-[#2a3e35] font-medium">Security will verify:</span><br />
                    When the {qrData.type === "DELIVERY" ? "delivery person" : "driver"} arrives, 
                    security will allow entry using permit ID <span className="font-mono text-[#1E293B]">{qrData.id}</span>. 
                    No action needed from you.
                  </p>
                </div>

                {/* Action Button */}
                <Button 
                  onClick={() => {
                    setShowQR(false);
                    toast.success("You will be notified when they arrive");
                  }}
                  className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                >
                  Got it, thanks
                </Button>
              </div>
            </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
