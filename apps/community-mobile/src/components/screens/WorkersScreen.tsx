import { useState } from "react";
import { ArrowLeft, Plus, UserCheck, Camera, QrCode, Calendar } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { workers } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";

interface WorkersScreenProps {
  contractorId?: string;
  onBack: () => void;
}

export function WorkersScreen({ contractorId, onBack }: WorkersScreenProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [workersList, setWorkersList] = useState(
    contractorId ? workers.filter(w => w.contractorId === contractorId) : []
  );

  // If no contractorId provided, show error state
  if (!contractorId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] p-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center mb-4">
            <button onClick={onBack} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-white">Workers</h1>
          </div>
        </div>

        {/* Error Message */}
        <div className="px-6 mt-8">
          <Card className="p-8 text-center">
            <p className="text-[#64748B] mb-4">No contractor selected</p>
            <Button onClick={onBack}>Go Back</Button>
          </Card>
        </div>
      </div>
    );
  }
  
  const [newWorker, setNewWorker] = useState({
    name: "",
    phone: "",
    nationalId: "",
    trade: "",
    idPhotoUploaded: false,
    validFrom: "",
    validUntil: "",
    accessType: "Daily"
  });

  const trades = [
    "Electrician",
    "Plumber",
    "Painter",
    "Carpenter",
    "Tiler",
    "Mason",
    "Helper",
    "Other"
  ];

  const accessTypes = ["Daily", "Weekly", "Monthly"];

  const handleAddWorker = () => {
    if (!newWorker.name || !newWorker.phone || !newWorker.nationalId || !newWorker.trade) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newWorker.nationalId.length !== 14) {
      toast.error("National ID must be 14 digits");
      return;
    }

    if (!newWorker.idPhotoUploaded) {
      toast.error("Please upload worker ID photo");
      return;
    }

    const worker = {
      id: `WKR-${Date.now()}`,
      name: newWorker.name,
      phone: newWorker.phone,
      nationalId: newWorker.nationalId,
      idPhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(newWorker.name)}&background=64748B&color=fff`,
      contractorId: contractorId,
      trade: newWorker.trade,
      permitStatus: "Active" as const,
      validFrom: newWorker.validFrom || new Date().toISOString().split('T')[0],
      validUntil: newWorker.validUntil,
      accessType: newWorker.accessType
    };

    setWorkersList([...workersList, worker]);
    toast.success(`${newWorker.name} added successfully!`);
    setIsAddDialogOpen(false);
    
    setNewWorker({
      name: "",
      phone: "",
      nationalId: "",
      trade: "",
      idPhotoUploaded: false,
      validFrom: "",
      validUntil: "",
      accessType: "Daily"
    });
  };

  const generateQR = (worker: any) => {
    toast.success(`QR Code generated for ${worker.name}`);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#c9a961] to-[#b89550] rounded-b-3xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-white">Workers</h2>
          <div className="w-6" />
        </div>

        <p className="text-white/80 text-sm">Manage worker entry permits</p>
      </div>

      {/* Content */}
      <div className="px-6">
        {/* Add Button */}
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="w-full h-12 rounded-xl bg-[#c9a961] hover:bg-[#b89550] mb-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Worker
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>

          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Worker</DialogTitle>
              <DialogDescription>
                Register a worker under this contractor
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div>
                <Label>Worker Name *</Label>
                <Input
                  value={newWorker.name}
                  onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                  placeholder="Full name"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Phone Number *</Label>
                <Input
                  value={newWorker.phone}
                  onChange={(e) => setNewWorker({ ...newWorker, phone: e.target.value })}
                  placeholder="+20 1XX XXX XXXX"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>National ID *</Label>
                <Input
                  value={newWorker.nationalId}
                  onChange={(e) => setNewWorker({ ...newWorker, nationalId: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                  placeholder="14-digit National ID"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                  maxLength={14}
                />
                <p className="text-xs text-[#64748B] mt-1">{newWorker.nationalId.length}/14 digits</p>
              </div>

              <div>
                <Label>Trade/Skill *</Label>
                <select
                  value={newWorker.trade}
                  onChange={(e) => setNewWorker({ ...newWorker, trade: e.target.value })}
                  className="mt-2 h-12 w-full rounded-xl bg-[#F9FAFB] border-0 px-3"
                >
                  <option value="">Select trade</option>
                  {trades.map((trade) => (
                    <option key={trade} value={trade}>{trade}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>ID Photo *</Label>
                <div
                  onClick={() => setNewWorker({ ...newWorker, idPhotoUploaded: true })}
                  className={`mt-2 h-32 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    newWorker.idPhotoUploaded
                      ? "border-[#c9a961] bg-[#c9a961]/5"
                      : "border-[#E2E8F0] hover:border-[#c9a961]"
                  } flex flex-col items-center justify-center`}
                >
                  {newWorker.idPhotoUploaded ? (
                    <>
                      <Camera className="w-8 h-8 text-[#c9a961] mb-2" />
                      <span className="text-sm text-[#c9a961]">Photo Uploaded ✓</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-[#64748B] mb-2" />
                      <span className="text-sm text-[#64748B]">Upload ID Photo</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valid From</Label>
                  <Input
                    type="date"
                    value={newWorker.validFrom}
                    onChange={(e) => setNewWorker({ ...newWorker, validFrom: e.target.value })}
                    className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                  />
                </div>
                <div>
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={newWorker.validUntil}
                    onChange={(e) => setNewWorker({ ...newWorker, validUntil: e.target.value })}
                    className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                  />
                </div>
              </div>

              <div>
                <Label>Access Type</Label>
                <select
                  value={newWorker.accessType}
                  onChange={(e) => setNewWorker({ ...newWorker, accessType: e.target.value })}
                  className="mt-2 h-12 w-full rounded-xl bg-[#F9FAFB] border-0 px-3"
                >
                  {accessTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1 h-11 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddWorker}
                  className="flex-1 h-11 rounded-xl bg-[#c9a961] hover:bg-[#b89550]"
                >
                  Add Worker
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Workers List */}
        <div className="space-y-3">
          {workersList.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-0">
              <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center mx-auto mb-3">
                <UserCheck className="w-8 h-8 text-[#64748B]" />
              </div>
              <p className="text-[#64748B]">No workers registered yet</p>
              <p className="text-sm text-[#64748B] mt-1">Add workers to generate entry permits</p>
            </Card>
          ) : (
            workersList.map((worker, index) => (
              <motion.div
                key={worker.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={worker.idPhoto} />
                      <AvatarFallback>{worker.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[#1E293B]">{worker.name}</h4>
                        <Badge className="bg-[#10B981] text-white rounded-full text-xs">
                          {worker.permitStatus}
                        </Badge>
                      </div>

                      <p className="text-sm text-[#64748B] mb-2">{worker.trade}</p>

                      <div className="space-y-1 text-xs text-[#64748B] mb-3">
                        <div className="flex items-center justify-between">
                          <span>National ID:</span>
                          <span className="text-[#1E293B]">{worker.nationalId}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Phone:</span>
                          <span className="text-[#1E293B]">{worker.phone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Access:</span>
                          <span className="text-[#1E293B]">{worker.accessType}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Valid:</span>
                          <span className="text-[#1E293B]">
                            {worker.validFrom} → {worker.validUntil}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => generateQR(worker)}
                        className="w-full h-9 rounded-lg bg-[#c9a961] hover:bg-[#b89550]"
                      >
                        <QrCode className="w-3 h-3 mr-2" />
                        Generate Entry Permit
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
