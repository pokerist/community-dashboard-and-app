import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Send, CheckCircle } from "lucide-react";
import { toast } from "sonner@2.0.3";

interface RequestFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  requestType: any;
  user: any;
}

export function RequestFormDialog({ isOpen, onClose, requestType, user }: RequestFormDialogProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  
  // Specific fields
  const [vehicleType, setVehicleType] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [eventType, setEventType] = useState("");
  const [numberOfGuests, setNumberOfGuests] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const resetForm = () => {
    setDescription("");
    setPreferredDate("");
    setPreferredTime("");
    setVehicleType("");
    setVehiclePlate("");
    setEventType("");
    setNumberOfGuests("");
    setCompanyName("");
    setContactPerson("");
    setPhoneNumber("");
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

    setStep("success");
    
    // Auto close after showing success
    setTimeout(() => {
      handleClose();
    }, 2500);
  };

  const renderPermitsForm = () => (
    <>
      <div>
        <Label>Permit Type</Label>
        <Select value={vehicleType} onValueChange={setVehicleType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select permit type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="visitor">Visitor Permit</SelectItem>
            <SelectItem value="worker">Worker Permit</SelectItem>
            <SelectItem value="delivery">Delivery Permit</SelectItem>
            <SelectItem value="contractor">Contractor Permit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Visitor/Worker Name</Label>
        <Input
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="Full name"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Phone Number</Label>
        <Input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+20 100 000 0000"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Visit Date</Label>
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
            value={numberOfGuests}
            onChange={(e) => setNumberOfGuests(e.target.value)}
            placeholder="1"
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>

      <div>
        <Label>Additional Notes</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any additional information..."
          className="mt-2 min-h-[80px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const renderTruckForm = () => (
    <>
      <div>
        <Label>Truck Type</Label>
        <Select value={vehicleType} onValueChange={setVehicleType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select truck type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small Truck</SelectItem>
            <SelectItem value="medium">Medium Truck</SelectItem>
            <SelectItem value="large">Large Truck</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Vehicle Plate Number</Label>
        <Input
          value={vehiclePlate}
          onChange={(e) => setVehiclePlate(e.target.value)}
          placeholder="ABC 1234"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Driver Name</Label>
        <Input
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="Full name"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Driver Phone</Label>
        <Input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+20 100 000 0000"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Access Date</Label>
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
        <Label>Purpose</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What will be transported? (Moving, Delivery, etc.)"
          className="mt-2 min-h-[80px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const renderEventForm = () => (
    <>
      <div>
        <Label>Event Type</Label>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="birthday">Birthday Party</SelectItem>
            <SelectItem value="wedding">Wedding</SelectItem>
            <SelectItem value="gathering">Family Gathering</SelectItem>
            <SelectItem value="business">Business Meeting</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Event Date</Label>
          <Input
            type="date"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
        <div>
          <Label>Start Time</Label>
          <Input
            type="time"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>

      <div>
        <Label>Expected Number of Guests</Label>
        <Input
          type="number"
          value={numberOfGuests}
          onChange={(e) => setNumberOfGuests(e.target.value)}
          placeholder="Number of guests"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Event Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your event and any special requirements..."
          className="mt-2 min-h-[100px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>
    </>
  );

  const renderCarStickerForm = () => (
    <>
      <div>
        <Label>Vehicle Make & Model</Label>
        <Input
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          placeholder="e.g., Toyota Camry 2023"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>License Plate Number</Label>
        <Input
          value={vehiclePlate}
          onChange={(e) => setVehiclePlate(e.target.value)}
          placeholder="ABC 1234"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Vehicle Color</Label>
        <Input
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="e.g., White, Black"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Owner Name</Label>
        <Input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Vehicle owner name"
          className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
        />
      </div>

      <div>
        <Label>Additional Notes</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Any additional information..."
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
          placeholder="Please describe your request in detail..."
          className="mt-2 min-h-[120px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Date (Optional)</Label>
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

  const getFormContent = () => {
    if (!requestType) return null;

    switch (requestType.id) {
      case "permits":
        return renderPermitsForm();
      case "truck":
        return renderTruckForm();
      case "event":
        return renderEventForm();
      case "car-sticker":
        return renderCarStickerForm();
      default:
        return renderGenericForm();
    }
  };

  if (!requestType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-4 rounded-3xl max-h-[90vh] overflow-y-auto">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-3">
                <span className="text-3xl">{requestType.icon && <requestType.icon className="w-8 h-8" />}</span>
                <span className="text-[#1E293B]">{requestType.name}</span>
              </DialogTitle>
              <DialogDescription className="text-[#64748B]">
                {requestType.description}
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
                Your {requestType.name} request has been submitted successfully. We'll get back to you soon.
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
