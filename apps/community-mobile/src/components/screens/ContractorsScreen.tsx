import { useState } from "react";
import { ArrowLeft, Plus, HardHat, Phone, Mail, CheckCircle2, Clock, X } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { contractors, workers } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";

interface ContractorsScreenProps {
  user?: any;
  onBack: () => void;
  onViewWorkers: (contractorId: string) => void;
}

export function ContractorsScreen({ user, onBack, onViewWorkers }: ContractorsScreenProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  // Filter contractors by user
  const userContractors = user ? contractors.filter(c => c.parentUserId === user.id) : [];
  const [contractorsList, setContractorsList] = useState(userContractors);
  
  const [newContractor, setNewContractor] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    service: "",
    license: ""
  });

  const serviceTypes = [
    "General Contracting",
    "Plumbing",
    "Electrical",
    "Painting",
    "HVAC",
    "Carpentry",
    "Tiling",
    "Landscaping",
    "Other"
  ];

  const handleAddContractor = () => {
    if (!newContractor.name || !newContractor.phone || !newContractor.service) {
      toast.error("Please fill in all required fields");
      return;
    }

    const contractor = {
      id: `CNT-${Date.now()}`,
      name: newContractor.companyName || newContractor.name,
      companyName: newContractor.companyName || newContractor.name,
      type: "Contractor",
      email: newContractor.email,
      phone: newContractor.phone,
      nationalId: "",
      service: newContractor.service,
      license: newContractor.license,
      approvalStatus: "Pending" as const,
      approvalDate: new Date().toISOString().split('T')[0],
      validUntil: "",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newContractor.name)}&background=c9a961&color=1a1a1a`,
      workers: []
    };

    setContractorsList([...contractorsList, contractor]);
    toast.success("Contractor request submitted for approval");
    setIsAddDialogOpen(false);
    
    setNewContractor({
      name: "",
      companyName: "",
      email: "",
      phone: "",
      service: "",
      license: ""
    });
  };

  const getWorkerCount = (contractorId: string) => {
    return workers.filter(w => w.contractorId === contractorId).length;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved": return "bg-[#10B981] text-white";
      case "Pending": return "bg-[#F59E0B] text-white";
      case "Rejected": return "bg-[#EF4444] text-white";
      default: return "bg-[#64748B] text-white";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved": return <CheckCircle2 className="w-3 h-3" />;
      case "Pending": return <Clock className="w-3 h-3" />;
      case "Rejected": return <X className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] rounded-b-3xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-white">Contractors</h2>
          <div className="w-6" />
        </div>

        <p className="text-white/80 text-sm">Manage approved contractors and their workers</p>
      </div>

      {/* Content */}
      <div className="px-6">
        {/* Add Button */}
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] mb-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          Request Contractor Approval
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Contractor Approval</DialogTitle>
              <DialogDescription>
                Submit contractor information for management approval
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              <div>
                <Label>Contractor Name *</Label>
                <Input
                  value={newContractor.name}
                  onChange={(e) => setNewContractor({ ...newContractor, name: e.target.value })}
                  placeholder="Contact person name"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Company Name</Label>
                <Input
                  value={newContractor.companyName}
                  onChange={(e) => setNewContractor({ ...newContractor, companyName: e.target.value })}
                  placeholder="Company or business name"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Service Type *</Label>
                <select
                  value={newContractor.service}
                  onChange={(e) => setNewContractor({ ...newContractor, service: e.target.value })}
                  className="mt-2 h-12 w-full rounded-xl bg-[#F9FAFB] border-0 px-3"
                >
                  <option value="">Select service type</option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Phone Number *</Label>
                <Input
                  value={newContractor.phone}
                  onChange={(e) => setNewContractor({ ...newContractor, phone: e.target.value })}
                  placeholder="+20 1XX XXX XXXX"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newContractor.email}
                  onChange={(e) => setNewContractor({ ...newContractor, email: e.target.value })}
                  placeholder="email@example.com"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>License Number</Label>
                <Input
                  value={newContractor.license}
                  onChange={(e) => setNewContractor({ ...newContractor, license: e.target.value })}
                  placeholder="Optional"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
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
                  onClick={handleAddContractor}
                  className="flex-1 h-11 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                >
                  Submit Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Contractors List */}
        <div className="space-y-3">
          {contractorsList.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-0">
              <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center mx-auto mb-3">
                <HardHat className="w-8 h-8 text-[#64748B]" />
              </div>
              <p className="text-[#64748B]">No contractors added yet</p>
              <p className="text-sm text-[#64748B] mt-1">Request contractor approval to get started</p>
            </Card>
          ) : (
            contractorsList.map((contractor, index) => (
              <motion.div
                key={contractor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={contractor.avatar} />
                      <AvatarFallback>
                        <HardHat className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[#1E293B]">{contractor.companyName}</h4>
                        <Badge className={`${getStatusColor(contractor.approvalStatus)} rounded-full text-xs`}>
                          <span className="mr-1">{getStatusIcon(contractor.approvalStatus)}</span>
                          {contractor.approvalStatus}
                        </Badge>
                      </div>

                      <p className="text-sm text-[#64748B] mb-2">{contractor.service}</p>

                      <div className="flex items-center space-x-3 text-xs text-[#64748B] mb-3">
                        {contractor.phone && (
                          <div className="flex items-center space-x-1">
                            <Phone className="w-3 h-3" />
                            <span>{contractor.phone}</span>
                          </div>
                        )}
                        {contractor.license && (
                          <div className="flex items-center space-x-1">
                            <span>License: {contractor.license}</span>
                          </div>
                        )}
                      </div>

                      {contractor.approvalStatus === "Approved" && (
                        <>
                          <div className="flex items-center justify-between text-sm mb-3">
                            <span className="text-[#64748B]">Workers:</span>
                            <Badge variant="outline">{getWorkerCount(contractor.id)} registered</Badge>
                          </div>

                          {contractor.validUntil && (
                            <div className="flex items-center justify-between text-sm mb-3">
                              <span className="text-[#64748B]">Valid Until:</span>
                              <span className="text-[#1E293B]">{contractor.validUntil}</span>
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewWorkers(contractor.id)}
                            className="w-full h-9 rounded-lg"
                          >
                            <HardHat className="w-3 h-3 mr-2" />
                            Manage Workers
                          </Button>
                        </>
                      )}

                      {contractor.approvalStatus === "Pending" && (
                        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg p-2 text-xs text-[#F59E0B]">
                          ⏳ Waiting for admin approval
                        </div>
                      )}
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
