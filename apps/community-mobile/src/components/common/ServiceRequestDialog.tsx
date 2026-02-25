import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Calendar, Clock, Send, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner@2.0.3";

interface ServiceRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  user: any;
}

export function ServiceRequestDialog({ isOpen, onClose, service, user }: ServiceRequestDialogProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  
  // Common fields
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [priority, setPriority] = useState("medium");
  
  // Maintenance-specific
  const [maintenanceType, setMaintenanceType] = useState("");
  
  // Cleaning-specific
  const [cleaningType, setCleaningType] = useState("");
  
  // Amenity-specific
  const [duration, setDuration] = useState("");
  const [numberOfGuests, setNumberOfGuests] = useState("");
  
  // Permit-specific
  const [companyName, setCompanyName] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [contractorPhone, setContractorPhone] = useState("");
  const [permitType, setPermitType] = useState("");
  
  const resetForm = () => {
    setDescription("");
    setPreferredDate("");
    setPreferredTime("");
    setPriority("medium");
    setMaintenanceType("");
    setCleaningType("");
    setDuration("");
    setNumberOfGuests("");
    setCompanyName("");
    setContractorName("");
    setContractorPhone("");
    setPermitType("");
    setStep("form");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error("Please provide a description");
      return;
    }

    // Validate based on service type
    if (service.id === "contractor" && (!companyName || !contractorName || !contractorPhone)) {
      toast.error("Please fill in all contractor details");
      return;
    }

    // Simulate API call
    setStep("success");
    
    // Auto close after showing success
    setTimeout(() => {
      handleClose();
    }, 2500);
  };

  const renderMaintenanceForm = () => (
    <>
      <div>
        <Label>Maintenance Type</Label>
        <Select value={maintenanceType} onValueChange={setMaintenanceType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plumbing">Plumbing</SelectItem>
            <SelectItem value="electrical">Electrical</SelectItem>
            <SelectItem value="ac">Air Conditioning</SelectItem>
            <SelectItem value="carpentry">Carpentry</SelectItem>
            <SelectItem value="painting">Painting</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low - Can wait</SelectItem>
            <SelectItem value="medium">Medium - Within a week</SelectItem>
            <SelectItem value="high">High - Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Problem Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue in detail..."
          className="mt-2 min-h-[100px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Preferred Date</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Preferred Time</Label>
          <Select value={preferredTime} onValueChange={setPreferredTime}>
            <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning (8-12)</SelectItem>
              <SelectItem value="afternoon">Afternoon (12-4)</SelectItem>
              <SelectItem value="evening">Evening (4-8)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );

  const renderCleaningForm = () => (
    <>
      <div>
        <Label>Cleaning Type</Label>
        <Select value={cleaningType} onValueChange={setCleaningType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="regular">Regular Cleaning</SelectItem>
            <SelectItem value="deep">Deep Cleaning</SelectItem>
            <SelectItem value="moveout">Move-out Cleaning</SelectItem>
            <SelectItem value="carpet">Carpet Cleaning</SelectItem>
            <SelectItem value="windows">Window Cleaning</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Time</Label>
          <Select value={preferredTime} onValueChange={setPreferredTime}>
            <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning (8-12)</SelectItem>
              <SelectItem value="afternoon">Afternoon (12-4)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Special Instructions</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any specific areas or requirements..."
          className="mt-2 min-h-[80px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const renderAmenityForm = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Time</Label>
          <Input
            type="time"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>

      {service.id === "clubhouse" && (
        <>
          <div>
            <Label>Duration (hours)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 hours</SelectItem>
                <SelectItem value="4">4 hours</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="8">Full day (8 hours)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Number of Guests</Label>
            <Input
              type="number"
              value={numberOfGuests}
              onChange={(e) => setNumberOfGuests(e.target.value)}
              placeholder="Expected number of guests"
              className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
            />
          </div>
        </>
      )}

      <div>
        <Label>Event/Purpose Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the purpose of your booking..."
          className="mt-2 min-h-[80px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const renderContractorPermitForm = () => (
    <>
      <div>
        <Label>Company Name</Label>
        <Input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Contractor company name"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Contractor Name</Label>
        <Input
          value={contractorName}
          onChange={(e) => setContractorName(e.target.value)}
          placeholder="Full name of contractor"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Contractor Phone</Label>
        <Input
          value={contractorPhone}
          onChange={(e) => setContractorPhone(e.target.value)}
          placeholder="+20 100 000 0000"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Permit Type</Label>
        <Select value={permitType} onValueChange={setPermitType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="renovation">Renovation</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="installation">Installation</SelectItem>
            <SelectItem value="painting">Painting</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Duration (days)</Label>
          <Input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Days"
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>

      <div>
        <Label>Work Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the work to be performed..."
          className="mt-2 min-h-[80px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const renderPestControlForm = () => (
    <>
      <div>
        <Label>Service Type</Label>
        <Select value={maintenanceType} onValueChange={setMaintenanceType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General Pest Control</SelectItem>
            <SelectItem value="termites">Termite Treatment</SelectItem>
            <SelectItem value="rodents">Rodent Control</SelectItem>
            <SelectItem value="insects">Flying Insects</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Preferred Date</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Time</Label>
          <Select value={preferredTime} onValueChange={setPreferredTime}>
            <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning (8-12)</SelectItem>
              <SelectItem value="afternoon">Afternoon (12-4)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Additional Notes</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any specific concerns or areas..."
          className="mt-2 min-h-[80px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const renderGenericForm = () => (
    <>
      <div>
        <Label>Request Details</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please describe your request..."
          className="mt-2 min-h-[120px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Preferred Date (Optional)</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Time (Optional)</Label>
          <Input
            type="time"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>
    </>
  );

  const renderConstructionForm = () => (
    <>
      <div>
        <Label>Visit/Request Type</Label>
        <Select value={permitType} onValueChange={setPermitType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="site-visit">Site Visit</SelectItem>
            <SelectItem value="progress-update">Progress Update Request</SelectItem>
            <SelectItem value="modification">Modification Request</SelectItem>
            <SelectItem value="inspection">Unit Inspection</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Preferred Date</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Preferred Time</Label>
          <Select value={preferredTime} onValueChange={setPreferredTime}>
            <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning (9-12)</SelectItem>
              <SelectItem value="afternoon">Afternoon (12-3)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Details</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please provide any specific details or questions..."
          className="mt-2 min-h-[100px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const getFormContent = () => {
    if (!service) return null;

    switch (service.id) {
      case "maintenance":
        return renderMaintenanceForm();
      case "cleaning":
        return renderCleaningForm();
      case "pest":
        return renderPestControlForm();
      case "gym":
      case "pool":
      case "clubhouse":
        return renderAmenityForm();
      case "contractor":
        return renderContractorPermitForm();
      // Under Construction services
      case "visit":
      case "progress":
      case "contract":
        return renderConstructionForm();
      default:
        return renderGenericForm();
    }
  };

  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-4 rounded-3xl max-h-[90vh] overflow-y-auto">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <span className="text-3xl">{service.icon}</span>
                <span className="text-[#1E293B]">{service.name}</span>
              </DialogTitle>
              <DialogDescription className="text-[#64748B]">
                {service.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Unit Info */}
              <div className="bg-[#F9FAFB] rounded-xl p-4">
                <p className="text-sm text-[#64748B]">Unit</p>
                <p className="text-[#1E293B]">{user.unit} • {user.compound}</p>
              </div>

              {/* Dynamic Form */}
              {getFormContent()}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 h-12 rounded-xl border-[#E2E8F0]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center">
                <CheckCircle className="w-16 h-16 text-[#10B981]" />
              </DialogTitle>
            </DialogHeader>

            <div className="text-center space-y-3 py-6">
              <h3 className="text-[#1E293B]">Request Submitted!</h3>
              <p className="text-[#64748B]">
                Your request for {service.name} has been submitted successfully. We'll get back to you soon.
              </p>
              <div className="bg-[#10B981]/10 rounded-xl p-4 mt-4">
                <p className="text-sm text-[#10B981]">
                  ✓ Request received and being processed
                </p>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
