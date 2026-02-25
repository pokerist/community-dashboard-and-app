import { useState } from "react";
import {
  ArrowLeft,
  UserPlus,
  Upload,
  Camera,
  CheckCircle2,
  Calendar,
  Phone,
  Mail,
  User,
  FileText,
  Shield,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { toast } from "sonner@2.0.3";

interface DelegationScreenProps {
  onBack: () => void;
}

export function DelegationScreen({
  onBack,
}: DelegationScreenProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    nationalId: "",
    phone: "",
    email: "",
    relationship: "",
    startDate: "",
    endDate: "",
    idCardFront: null as File | null,
    idCardBack: null as File | null,
  });

  const [permissions, setPermissions] = useState({
    accessUnit: false,
    receivePackages: false,
    requestServices: false,
    parkingAccess: false,
    facilitiesAccess: false,
  });

  const [showSuccessDialog, setShowSuccessDialog] =
    useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (
    field: "idCardFront" | "idCardBack",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, [field]: file }));
    }
  };

  const handlePermissionToggle = (
    permission: keyof typeof permissions,
  ) => {
    setPermissions((prev) => ({
      ...prev,
      [permission]: !prev[permission],
    }));
  };

  const handleSubmit = () => {
    // Validation
    if (
      !formData.fullName ||
      !formData.nationalId ||
      !formData.phone
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (
      !permissions.accessUnit &&
      !permissions.receivePackages &&
      !permissions.requestServices &&
      !permissions.parkingAccess &&
      !permissions.facilitiesAccess
    ) {
      toast.error("Please select at least one permission");
      return;
    }

    // Here you would typically send the data to your backend
    console.log("Delegation data:", formData, permissions);
    setShowSuccessDialog(true);
  };

  const handleDialogClose = () => {
    setShowSuccessDialog(false);
    onBack();
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] px-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white">Delegation</h1>
            <p className="text-white/60 text-sm mt-1">
              Add a delegated person
            </p>
          </div>
        </div>

        <Card className="p-4 rounded-2xl border-0 bg-white/10 backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#c9a961]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#c9a961]" />
            </div>
            <div>
              <p className="text-white text-sm">
                Delegate access to trusted individuals
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                All delegations require admin approval
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="px-6 mt-6 space-y-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-[#1E293B] mb-4">
            Personal Information
          </h3>

          <Card className="p-5 rounded-2xl border-0">
            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="fullName"
                  className="text-[#1E293B] mb-2 block"
                >
                  Full Name{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                  <Input
                    id="fullName"
                    placeholder="Enter full name"
                    value={formData.fullName}
                    onChange={(e) =>
                      handleInputChange(
                        "fullName",
                        e.target.value,
                      )
                    }
                    className="pl-10 h-12 rounded-xl border-gray-200 bg-[#F9FAFB]"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="nationalId"
                  className="text-[#1E293B] mb-2 block"
                >
                  National ID / Passport{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                  <Input
                    id="nationalId"
                    placeholder="Enter ID number"
                    value={formData.nationalId}
                    onChange={(e) =>
                      handleInputChange(
                        "nationalId",
                        e.target.value,
                      )
                    }
                    className="pl-10 h-12 rounded-xl border-gray-200 bg-[#F9FAFB]"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="phone"
                  className="text-[#1E293B] mb-2 block"
                >
                  Phone Number{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+20 XXX XXX XXXX"
                    value={formData.phone}
                    onChange={(e) =>
                      handleInputChange("phone", e.target.value)
                    }
                    className="pl-10 h-12 rounded-xl border-gray-200 bg-[#F9FAFB]"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="email"
                  className="text-[#1E293B] mb-2 block"
                >
                  Email (Optional)
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      handleInputChange("email", e.target.value)
                    }
                    className="pl-10 h-12 rounded-xl border-gray-200 bg-[#F9FAFB]"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="relationship"
                  className="text-[#1E293B] mb-2 block"
                >
                  Relationship
                </Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) =>
                    handleInputChange("relationship", value)
                  }
                >
                  <SelectTrigger className="h-12 rounded-xl border-gray-200 bg-[#F9FAFB]">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">
                      Family Member
                    </SelectItem>
                    <SelectItem value="friend">
                      Friend
                    </SelectItem>
                    <SelectItem value="assistant">
                      Assistant
                    </SelectItem>
                    <SelectItem value="employee">
                      Employee
                    </SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </div>

        {/* Delegation Period */}
        <div>
          <h3 className="text-[#1E293B] mb-4">
            Delegation Period
          </h3>

          <Card className="p-5 rounded-2xl border-0">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="startDate"
                  className="text-[#1E293B] mb-2 block text-sm"
                >
                  Start Date
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      handleInputChange(
                        "startDate",
                        e.target.value,
                      )
                    }
                    className="pl-9 h-11 rounded-xl border-gray-200 bg-[#F9FAFB] text-sm"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="endDate"
                  className="text-[#1E293B] mb-2 block text-sm"
                >
                  End Date
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      handleInputChange(
                        "endDate",
                        e.target.value,
                      )
                    }
                    className="pl-9 h-11 rounded-xl border-gray-200 bg-[#F9FAFB] text-sm"
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-[#64748B] mt-3">
              Leave end date empty for permanent delegation
            </p>
          </Card>
        </div>

        {/* Permissions */}
        <div>
          <h3 className="text-[#1E293B] mb-4">Permissions</h3>

          <Card className="p-5 rounded-2xl border-0">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="accessUnit"
                  checked={permissions.accessUnit}
                  onCheckedChange={() =>
                    handlePermissionToggle("accessUnit")
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="accessUnit"
                    className="text-[#1E293B] text-sm cursor-pointer"
                  >
                    Unit Access
                  </label>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Allow access to enter the unit
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="receivePackages"
                  checked={permissions.receivePackages}
                  onCheckedChange={() =>
                    handlePermissionToggle("receivePackages")
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="receivePackages"
                    className="text-[#1E293B] text-sm cursor-pointer"
                  >
                    Receive Packages
                  </label>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Allow to receive deliveries and packages
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="requestServices"
                  checked={permissions.requestServices}
                  onCheckedChange={() =>
                    handlePermissionToggle("requestServices")
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="requestServices"
                    className="text-[#1E293B] text-sm cursor-pointer"
                  >
                    Request Services
                  </label>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Allow to request maintenance and services
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="parkingAccess"
                  checked={permissions.parkingAccess}
                  onCheckedChange={() =>
                    handlePermissionToggle("parkingAccess")
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="parkingAccess"
                    className="text-[#1E293B] text-sm cursor-pointer"
                  >
                    Parking Access
                  </label>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Allow access to parking areas
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="facilitiesAccess"
                  checked={permissions.facilitiesAccess}
                  onCheckedChange={() =>
                    handlePermissionToggle("facilitiesAccess")
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="facilitiesAccess"
                    className="text-[#1E293B] text-sm cursor-pointer"
                  >
                    Facilities Access
                  </label>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Allow access to gym, pool, and other
                    facilities
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ID Documents Upload */}
        <div>
          <h3 className="text-[#1E293B] mb-4">ID Documents</h3>

          <Card className="p-5 rounded-2xl border-0">
            <div className="space-y-4">
              <div>
                <Label className="text-[#1E293B] mb-3 block">
                  National ID / Passport (Front)
                </Label>
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleFileUpload("idCardFront", e)
                    }
                    className="hidden"
                  />
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      formData.idCardFront
                        ? "border-[#2a3e35] bg-[#2a3e35]/5"
                        : "border-gray-300 hover:border-[#2a3e35]"
                    }`}
                  >
                    {formData.idCardFront ? (
                      <div className="flex items-center justify-center space-x-3">
                        <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
                        <div>
                          <p className="text-[#1E293B] text-sm">
                            {formData.idCardFront.name}
                          </p>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            Click to change
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                        <p className="text-[#1E293B] text-sm">
                          Upload ID Front
                        </p>
                        <p className="text-xs text-[#64748B] mt-1">
                          Click to browse or drag and drop
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </div>

              <div>
                <Label className="text-[#1E293B] mb-3 block">
                  National ID / Passport (Back)
                </Label>
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleFileUpload("idCardBack", e)
                    }
                    className="hidden"
                  />
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      formData.idCardBack
                        ? "border-[#2a3e35] bg-[#2a3e35]/5"
                        : "border-gray-300 hover:border-[#2a3e35]"
                    }`}
                  >
                    {formData.idCardBack ? (
                      <div className="flex items-center justify-center space-x-3">
                        <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
                        <div>
                          <p className="text-[#1E293B] text-sm">
                            {formData.idCardBack.name}
                          </p>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            Click to change
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                        <p className="text-[#1E293B] text-sm">
                          Upload ID Back
                        </p>
                        <p className="text-xs text-[#64748B] mt-1">
                          Click to browse or drag and drop
                        </p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>
          </Card>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          className="w-full h-14 rounded-2xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Submit Delegation Request
        </Button>

        <p className="text-xs text-center text-[#64748B]">
          Your delegation request will be reviewed by the admin
          team
        </p>
      </div>

      {/* Success Dialog */}
      <AlertDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
      >
        <AlertDialogContent className="max-w-[90%] rounded-3xl">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-[#1E293B]">
              Delegation Request Submitted
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <div className="space-y-3 mt-4">
                <p className="text-[#64748B]">
                  Your delegation request has been submitted
                  successfully and is now awaiting admin
                  approval.
                </p>

                <Card className="p-4 rounded-2xl border-0 bg-[#c9a961]/5">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-[#c9a961] flex-shrink-0 mt-0.5" />
                    <div className="text-left">
                      <p className="text-sm text-[#1E293B]">
                        You will receive a notification once the
                        admin reviews and approves the
                        delegation.
                        <br />
                        Once confirmed the delegated user shall
                        receive an email address with his
                        credentials.
                      </p>
                    </div>
                  </div>
                </Card>

                <div className="bg-[#F9FAFB] rounded-xl p-3 text-left">
                  <p className="text-xs text-[#64748B] mb-2">
                    Delegated Person:
                  </p>
                  <p className="text-sm text-[#1E293B]">
                    👤 {formData.fullName || "N/A"}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">
                    ID: {formData.nationalId || "N/A"}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleDialogClose}
              className="w-full h-12 rounded-2xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}