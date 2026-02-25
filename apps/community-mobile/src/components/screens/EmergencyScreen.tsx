import { useState } from "react";
import { ArrowLeft, AlertTriangle, Phone, MapPin, Shield, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { emergencyContacts } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";

interface EmergencyScreenProps {
  user: any;
  onBack: () => void;
}

export function EmergencyScreen({ user, onBack }: EmergencyScreenProps) {
  const [isSOSDialogOpen, setIsSOSDialogOpen] = useState(false);
  const [isPINDialogOpen, setIsPINDialogOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [sosActivated, setSosActivated] = useState(false);

  const handleSOSPress = () => {
    setIsPINDialogOpen(true);
  };

  const handlePINSubmit = () => {
    if (pin.length !== 4) {
      toast.error("Please enter a 4-digit PIN");
      return;
    }

    // Simulate PIN verification (in production, verify against user's actual PIN)
    if (pin === "1234") {
      setIsPINDialogOpen(false);
      setPin("");
      activateSOS();
    } else {
      toast.error("Incorrect PIN");
      setPin("");
    }
  };

  const activateSOS = () => {
    setSosActivated(true);
    toast.success("Emergency SOS activated!");
    
    // Simulate sending location and alert
    setTimeout(() => {
      setIsSOSDialogOpen(true);
    }, 500);
  };

  const handlePINInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handlePINDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] rounded-b-3xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-white">Emergency</h2>
          <div className="w-6" />
        </div>

        <p className="text-white/80 text-sm">Quick access to emergency services</p>
      </div>

      {/* Content */}
      <div className="px-6 space-y-6">
        {/* SOS Button */}
        <Card className="p-8 text-center rounded-2xl border-0 bg-gradient-to-br from-[#EF4444] to-[#DC2626]">
          <div className="mb-6">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSOSPress}
              className={`w-32 h-32 rounded-full mx-auto flex items-center justify-center shadow-2xl transition-all ${
                sosActivated 
                  ? "bg-[#10B981] animate-pulse" 
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              {sosActivated ? (
                <CheckCircle2 className="w-16 h-16 text-white" />
              ) : (
                <AlertTriangle className="w-16 h-16 text-[#EF4444]" />
              )}
            </motion.button>
          </div>

          <h3 className="text-white mb-2">Emergency SOS</h3>
          <p className="text-white/80 text-sm mb-4">
            {sosActivated 
              ? "Help is on the way!" 
              : "Press to alert security and share your location"
            }
          </p>

          {sosActivated && (
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-white text-sm">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <MapPin className="w-4 h-4" />
                <span>Location shared with security</span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Clock className="w-4 h-4" />
                <span>Response time: ~3 minutes</span>
              </div>
            </div>
          )}
        </Card>

        {/* User Info Card (for security) */}
        <Card className="p-4 rounded-2xl border-0">
          <div className="flex items-center space-x-3 mb-3">
            <Shield className="w-5 h-5 text-[#2a3e35]" />
            <h4 className="text-[#1E293B]">Your Emergency Profile</h4>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Name:</span>
              <span className="text-[#1E293B]">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Unit:</span>
              <span className="text-[#1E293B]">{user.unit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Compound:</span>
              <span className="text-[#1E293B]">{user.compound}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#64748B]">Phone:</span>
              <span className="text-[#1E293B]">{user.phone}</span>
            </div>
          </div>
        </Card>

        {/* Emergency Contacts */}
        <div>
          <h3 className="text-[#1E293B] mb-4">Emergency Contacts</h3>
          <div className="space-y-3">
            {emergencyContacts.map((contact, index) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        contact.type === "Security" ? "bg-[#2a3e35]/10" :
                        contact.type === "Medical" ? "bg-[#EF4444]/10" :
                        contact.type === "Fire" ? "bg-[#F59E0B]/10" :
                        "bg-[#3B82F6]/10"
                      }`}>
                        <Phone className={`w-5 h-5 ${
                          contact.type === "Security" ? "text-[#2a3e35]" :
                          contact.type === "Medical" ? "text-[#EF4444]" :
                          contact.type === "Fire" ? "text-[#F59E0B]" :
                          "text-[#3B82F6]"
                        }`} />
                      </div>
                      <div>
                        <p className="text-[#1E293B]">{contact.name}</p>
                        <p className="text-sm text-[#64748B]">{contact.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {contact.available24 && (
                        <Badge variant="outline" className="text-xs">
                          24/7
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        onClick={() => toast.success(`Calling ${contact.name}...`)}
                        className="h-9 rounded-lg bg-[#10B981] hover:bg-[#059669]"
                      >
                        <Phone className="w-3 h-3 mr-1" />
                        Call
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Safety Tips */}
        <Card className="p-4 rounded-2xl border-0 bg-[#3B82F6]/5">
          <h4 className="text-[#1E293B] mb-3">Safety Tips</h4>
          <ul className="space-y-2 text-sm text-[#64748B]">
            <li className="flex items-start space-x-2">
              <span className="text-[#3B82F6]">•</span>
              <span>Use SOS only in genuine emergencies</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#3B82F6]">•</span>
              <span>Your location will be shared with security</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#3B82F6]">•</span>
              <span>Keep your emergency contacts updated</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-[#3B82F6]">•</span>
              <span>Stay calm and wait for help to arrive</span>
            </li>
          </ul>
        </Card>
      </div>

      {/* PIN Verification Dialog */}
      <Dialog open={isPINDialogOpen} onOpenChange={setIsPINDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Enter PIN to Activate SOS</DialogTitle>
            <DialogDescription className="text-center">
              Enter your 4-digit PIN to confirm emergency activation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* PIN Display */}
            <div className="flex justify-center space-x-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center ${
                    pin.length > i ? "border-[#EF4444] bg-[#EF4444]" : "border-[#E2E8F0]"
                  }`}
                >
                  {pin.length > i && <div className="w-3 h-3 rounded-full bg-white" />}
                </div>
              ))}
            </div>

            {/* PIN Pad */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePINInput(digit.toString())}
                  className="h-14 rounded-xl bg-[#F9FAFB] hover:bg-[#E2E8F0] transition-colors"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handlePINDelete}
                className="h-14 rounded-xl bg-[#F9FAFB] hover:bg-[#E2E8F0] transition-colors text-sm"
              >
                Delete
              </button>
              <button
                onClick={() => handlePINInput("0")}
                className="h-14 rounded-xl bg-[#F9FAFB] hover:bg-[#E2E8F0] transition-colors"
              >
                0
              </button>
              <button
                onClick={handlePINSubmit}
                className="h-14 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white transition-colors"
              >
                OK
              </button>
            </div>

            <p className="text-xs text-center text-[#64748B]">
              For demo purposes, use PIN: 1234
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* SOS Activated Dialog */}
      <Dialog open={isSOSDialogOpen} onOpenChange={setIsSOSDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Emergency SOS Activated</DialogTitle>
            <DialogDescription>Your emergency alert has been sent successfully</DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-4 py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 10 }}
              className="w-20 h-20 rounded-full bg-[#10B981] flex items-center justify-center mx-auto"
            >
              <Shield className="w-10 h-10 text-white" />
            </motion.div>

            <h3 className="text-[#1E293B]">Emergency Alert Sent!</h3>
            
            <div className="space-y-2 text-sm text-[#64748B]">
              <p>✓ Security has been notified</p>
              <p>✓ Your location has been shared</p>
              <p>✓ Your profile has been sent</p>
            </div>

            <div className="p-4 bg-[#10B981]/10 rounded-xl">
              <p className="text-sm text-[#10B981]">
                Help will arrive in approximately 3 minutes
              </p>
            </div>

            <Button
              onClick={() => {
                setIsSOSDialogOpen(false);
                toast.success("Stay safe! Help is on the way.");
              }}
              className="w-full h-11 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
