import { useState } from "react";
import { ArrowLeft, Plus, FileText, Calendar, DollarSign, User, Phone, Mail, Upload, CheckCircle2, Clock } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import { leases, services } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";

interface LeaseManagementScreenProps {
  onBack: () => void;
}

export function LeaseManagementScreen({ onBack }: LeaseManagementScreenProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [leasesList, setLeasesList] = useState(leases);
  
  const [newLease, setNewLease] = useState({
    tenantName: "",
    tenantEmail: "",
    tenantPhone: "",
    tenantNationalId: "",
    startDate: "",
    endDate: "",
    monthlyRent: "",
    depositAmount: "",
    contractUploaded: false,
    idUploaded: false,
    autoRenew: false,
    permissions: {
      qrCodes: true,
      services: [] as string[],
      complaints: true,
      payments: true
    }
  });

  const availableServices = services.delivered.filter(s => 
    ["maintenance", "cleaning", "gym", "pool", "clubhouse", "pest"].includes(s.id)
  );

  const handleAddLease = () => {
    if (!newLease.tenantName || !newLease.tenantPhone || !newLease.startDate || !newLease.endDate || !newLease.monthlyRent) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!newLease.contractUploaded || !newLease.idUploaded) {
      toast.error("Please upload contract and ID documents");
      return;
    }

    const lease = {
      id: `LEASE-${Date.now()}`,
      unitId: "UNIT-001",
      unitNumber: "Villa A-125",
      compound: "Karma Gates",
      landlordId: "USR-001",
      landlordName: "Ahmed Hassan Mohamed",
      tenantId: `USR-${Date.now()}`,
      tenantName: newLease.tenantName,
      tenantPhone: newLease.tenantPhone,
      tenantEmail: newLease.tenantEmail,
      tenantNationalId: newLease.tenantNationalId,
      contractDocument: "contract.pdf",
      idDocument: "id.pdf",
      startDate: newLease.startDate,
      endDate: newLease.endDate,
      monthlyRent: parseFloat(newLease.monthlyRent),
      depositAmount: parseFloat(newLease.depositAmount),
      status: "Active" as const,
      daysRemaining: Math.floor((new Date(newLease.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
      autoRenew: newLease.autoRenew,
      permissions: newLease.permissions
    };

    setLeasesList([...leasesList, lease]);
    toast.success("Lease added successfully! Tenant will receive access credentials.");
    setIsAddDialogOpen(false);
    
    // Reset form
    setNewLease({
      tenantName: "",
      tenantEmail: "",
      tenantPhone: "",
      tenantNationalId: "",
      startDate: "",
      endDate: "",
      monthlyRent: "",
      depositAmount: "",
      contractUploaded: false,
      idUploaded: false,
      autoRenew: false,
      permissions: {
        qrCodes: true,
        services: [],
        complaints: true,
        payments: true
      }
    });
  };

  const toggleServicePermission = (serviceId: string) => {
    const services = newLease.permissions.services;
    if (services.includes(serviceId)) {
      setNewLease({
        ...newLease,
        permissions: {
          ...newLease.permissions,
          services: services.filter(s => s !== serviceId)
        }
      });
    } else {
      setNewLease({
        ...newLease,
        permissions: {
          ...newLease.permissions,
          services: [...services, serviceId]
        }
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-[#10B981] text-white";
      case "Expiring Soon": return "bg-[#F59E0B] text-white";
      case "Expired": return "bg-[#EF4444] text-white";
      default: return "bg-[#64748B] text-white";
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
          <h2 className="text-white">Lease Management</h2>
          <div className="w-6" />
        </div>

        <p className="text-white/80 text-sm">Manage your property leases and tenants</p>
      </div>

      {/* Content */}
      <div className="px-6">
        {/* Add Button */}
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] mb-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add New Lease
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>

          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Lease</DialogTitle>
              <DialogDescription>
                Create a new lease agreement and grant tenant access
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              {/* Tenant Info */}
              <div className="border-b pb-4">
                <Label className="mb-3 block">Tenant Information</Label>
                
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Full Name *</Label>
                    <Input
                      value={newLease.tenantName}
                      onChange={(e) => setNewLease({ ...newLease, tenantName: e.target.value })}
                      placeholder="Enter tenant's full name"
                      className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Phone Number *</Label>
                    <Input
                      value={newLease.tenantPhone}
                      onChange={(e) => setNewLease({ ...newLease, tenantPhone: e.target.value })}
                      placeholder="+20 1XX XXX XXXX"
                      className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Email</Label>
                    <Input
                      type="email"
                      value={newLease.tenantEmail}
                      onChange={(e) => setNewLease({ ...newLease, tenantEmail: e.target.value })}
                      placeholder="email@example.com"
                      className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                    />
                  </div>

                  <div>
                    <Label className="text-sm">National ID</Label>
                    <Input
                      value={newLease.tenantNationalId}
                      onChange={(e) => setNewLease({ ...newLease, tenantNationalId: e.target.value.replace(/\D/g, '').slice(0, 14) })}
                      placeholder="14-digit National ID"
                      className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                      maxLength={14}
                    />
                  </div>
                </div>
              </div>

              {/* Lease Details */}
              <div className="border-b pb-4">
                <Label className="mb-3 block">Lease Details</Label>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Start Date *</Label>
                      <Input
                        type="date"
                        value={newLease.startDate}
                        onChange={(e) => setNewLease({ ...newLease, startDate: e.target.value })}
                        className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">End Date *</Label>
                      <Input
                        type="date"
                        value={newLease.endDate}
                        onChange={(e) => setNewLease({ ...newLease, endDate: e.target.value })}
                        className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Monthly Rent (EGP) *</Label>
                      <Input
                        type="number"
                        value={newLease.monthlyRent}
                        onChange={(e) => setNewLease({ ...newLease, monthlyRent: e.target.value })}
                        placeholder="5000"
                        className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Deposit (EGP)</Label>
                      <Input
                        type="number"
                        value={newLease.depositAmount}
                        onChange={(e) => setNewLease({ ...newLease, depositAmount: e.target.value })}
                        placeholder="10000"
                        className="mt-2 h-11 rounded-xl bg-[#F9FAFB] border-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-[#F9FAFB] rounded-xl">
                    <Checkbox
                      id="autoRenew"
                      checked={newLease.autoRenew}
                      onCheckedChange={(checked) => setNewLease({ ...newLease, autoRenew: !!checked })}
                    />
                    <label htmlFor="autoRenew" className="text-sm text-[#64748B]">
                      Auto-renew lease
                    </label>
                  </div>
                </div>
              </div>

              {/* Document Upload */}
              <div className="border-b pb-4">
                <Label className="mb-3 block">Documents *</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setNewLease({ ...newLease, contractUploaded: true })}
                    className={`h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      newLease.contractUploaded
                        ? "border-[#10B981] bg-[#10B981]/5"
                        : "border-[#E2E8F0] hover:border-[#2a3e35]"
                    } flex flex-col items-center justify-center`}
                  >
                    {newLease.contractUploaded ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-[#10B981] mb-1" />
                        <span className="text-xs text-[#10B981]">Contract ✓</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-[#64748B] mb-1" />
                        <span className="text-xs text-[#64748B]">Contract</span>
                      </>
                    )}
                  </div>

                  <div
                    onClick={() => setNewLease({ ...newLease, idUploaded: true })}
                    className={`h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                      newLease.idUploaded
                        ? "border-[#10B981] bg-[#10B981]/5"
                        : "border-[#E2E8F0] hover:border-[#2a3e35]"
                    } flex flex-col items-center justify-center`}
                  >
                    {newLease.idUploaded ? (
                      <>
                        <CheckCircle2 className="w-6 h-6 text-[#10B981] mb-1" />
                        <span className="text-xs text-[#10B981]">ID Copy ✓</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-[#64748B] mb-1" />
                        <span className="text-xs text-[#64748B]">ID Copy</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <Label className="mb-3 block">Tenant Permissions</Label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Generate QR Codes</span>
                    <Checkbox
                      checked={newLease.permissions.qrCodes}
                      onCheckedChange={(checked) => 
                        setNewLease({
                          ...newLease,
                          permissions: { ...newLease.permissions, qrCodes: !!checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Submit Complaints</span>
                    <Checkbox
                      checked={newLease.permissions.complaints}
                      onCheckedChange={(checked) => 
                        setNewLease({
                          ...newLease,
                          permissions: { ...newLease.permissions, complaints: !!checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Make Payments</span>
                    <Checkbox
                      checked={newLease.permissions.payments}
                      onCheckedChange={(checked) => 
                        setNewLease({
                          ...newLease,
                          permissions: { ...newLease.permissions, payments: !!checked }
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t">
                  <Label className="mb-2 block text-sm">Allowed Services</Label>
                  <div className="space-y-2">
                    {availableServices.map((service) => (
                      <div key={service.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{service.icon}</span>
                          <span className="text-sm">{service.name}</span>
                        </div>
                        <Checkbox
                          checked={newLease.permissions.services.includes(service.id)}
                          onCheckedChange={() => toggleServicePermission(service.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  className="flex-1 h-11 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddLease}
                  className="flex-1 h-11 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                >
                  Add Lease
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Leases List */}
        <div className="space-y-4">
          {leasesList.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-0">
              <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-8 h-8 text-[#64748B]" />
              </div>
              <p className="text-[#64748B]">No active leases</p>
              <p className="text-sm text-[#64748B] mt-1">Add a lease to get started</p>
            </Card>
          ) : (
            leasesList.map((lease, index) => (
              <motion.div
                key={lease.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(lease.tenantName)}&background=2a3e35&color=fff`} />
                        <AvatarFallback>{lease.tenantName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="text-[#1E293B]">{lease.tenantName}</h4>
                        <p className="text-sm text-[#64748B]">{lease.unitNumber}</p>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(lease.status)} rounded-full text-xs`}>
                      {lease.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-[#64748B]" />
                      <div>
                        <p className="text-xs text-[#64748B]">Lease Period</p>
                        <p className="text-sm text-[#1E293B]">{lease.startDate} → {lease.endDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-[#64748B]" />
                      <div>
                        <p className="text-xs text-[#64748B]">Monthly Rent</p>
                        <p className="text-sm text-[#1E293B]">EGP {lease.monthlyRent.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-xl mb-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-[#64748B]" />
                      <span className="text-sm text-[#64748B]">Days remaining:</span>
                    </div>
                    <span className="text-[#1E293B]">{lease.daysRemaining} days</span>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-lg"
                    >
                      View Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-lg"
                    >
                      Contact Tenant
                    </Button>
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
