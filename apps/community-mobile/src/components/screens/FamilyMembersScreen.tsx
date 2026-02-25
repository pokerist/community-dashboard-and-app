import { useState } from "react";
import { ArrowLeft, Plus, UserPlus, Mail, Phone, Edit2, Trash2, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { familyMembers, services } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";

interface FamilyMembersScreenProps {
  user?: any;
  onBack: () => void;
}

export function FamilyMembersScreen({ user, onBack }: FamilyMembersScreenProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  // Filter family members by user
  const userFamilyMembers = user ? familyMembers.filter(m => m.parentUserId === user.id) : [];
  const [members, setMembers] = useState(userFamilyMembers);
  
  // Form state for adding new member
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    phone: "",
    relation: "",
    permissions: {
      qrCodes: false,
      services: [] as string[],
      complaints: false,
      payments: false,
      smartHome: false,
      cameras: false
    }
  });

  const relationships = [
    "Spouse", "Son", "Daughter", "Father", "Mother", 
    "Brother", "Sister", "Driver", "Housekeeper", "Other"
  ];

  const availableServices = services.delivered.filter(s => 
    ["maintenance", "cleaning", "gym", "pool", "clubhouse", "pest"].includes(s.id)
  );

  const handleAddMember = () => {
    if (!newMember.name || !newMember.phone || !newMember.relation) {
      toast.error("Please fill in all required fields");
      return;
    }

    const member = {
      id: `USR-${Date.now()}`,
      name: newMember.name,
      email: newMember.email,
      relation: newMember.relation,
      phone: newMember.phone,
      nationalId: "",
      hasAppAccess: true,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newMember.name)}&background=2a3e35&color=fff`,
      permissions: newMember.permissions
    };

    setMembers([...members, member]);
    toast.success(`${newMember.name} added successfully!`);
    setIsAddDialogOpen(false);
    
    // Reset form
    setNewMember({
      name: "",
      email: "",
      phone: "",
      relation: "",
      permissions: {
        qrCodes: false,
        services: [],
        complaints: false,
        payments: false,
        smartHome: false,
        cameras: false
      }
    });
  };

  const handleRemoveMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
    toast.success("Family member removed");
  };

  const toggleServicePermission = (serviceId: string) => {
    const services = newMember.permissions.services;
    if (services.includes(serviceId)) {
      setNewMember({
        ...newMember,
        permissions: {
          ...newMember.permissions,
          services: services.filter(s => s !== serviceId)
        }
      });
    } else {
      setNewMember({
        ...newMember,
        permissions: {
          ...newMember.permissions,
          services: [...services, serviceId]
        }
      });
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
          <h2 className="text-white">Family Members</h2>
          <div className="w-6" />
        </div>

        <p className="text-white/80 text-sm">Manage family member accounts and permissions</p>
      </div>

      {/* Content */}
      <div className="px-6">
        {/* Add Button */}
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="w-full h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] mb-6"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Family Member
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>

          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Family Member</DialogTitle>
              <DialogDescription>
                Add a family member to grant them access permissions
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              {/* Basic Info */}
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Enter full name"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Relationship *</Label>
                <Select
                  value={newMember.relation}
                  onValueChange={(value) => setNewMember({ ...newMember, relation: value })}
                >
                  <SelectTrigger className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {relationships.map((rel) => (
                      <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Phone Number *</Label>
                <Input
                  value={newMember.phone}
                  onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                  placeholder="+20 1XX XXX XXXX"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Email (Optional)</Label>
                <Input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="email@example.com"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              {/* Permissions */}
              <div className="border-t pt-4">
                <Label className="mb-4 block">Permissions</Label>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Generate QR Codes</span>
                    <Checkbox
                      checked={newMember.permissions.qrCodes}
                      onCheckedChange={(checked) => 
                        setNewMember({
                          ...newMember,
                          permissions: { ...newMember.permissions, qrCodes: !!checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Submit Complaints</span>
                    <Checkbox
                      checked={newMember.permissions.complaints}
                      onCheckedChange={(checked) => 
                        setNewMember({
                          ...newMember,
                          permissions: { ...newMember.permissions, complaints: !!checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Make Payments</span>
                    <Checkbox
                      checked={newMember.permissions.payments}
                      onCheckedChange={(checked) => 
                        setNewMember({
                          ...newMember,
                          permissions: { ...newMember.permissions, payments: !!checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Smart Home Control</span>
                    <Checkbox
                      checked={newMember.permissions.smartHome}
                      onCheckedChange={(checked) => 
                        setNewMember({
                          ...newMember,
                          permissions: { ...newMember.permissions, smartHome: !!checked }
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Camera Access</span>
                    <Checkbox
                      checked={newMember.permissions.cameras}
                      onCheckedChange={(checked) => 
                        setNewMember({
                          ...newMember,
                          permissions: { ...newMember.permissions, cameras: !!checked }
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Service Permissions */}
              <div className="border-t pt-4">
                <Label className="mb-3 block">Allowed Services</Label>
                <div className="space-y-2">
                  {availableServices.map((service) => (
                    <div key={service.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{service.icon}</span>
                        <span className="text-sm">{service.name}</span>
                      </div>
                      <Checkbox
                        checked={newMember.permissions.services.includes(service.id)}
                        onCheckedChange={() => toggleServicePermission(service.id)}
                      />
                    </div>
                  ))}
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
                  onClick={handleAddMember}
                  className="flex-1 h-11 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                >
                  Add Member
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Members List */}
        <div className="space-y-3">
          {members.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl border-0">
              <div className="w-16 h-16 rounded-full bg-[#F9FAFB] flex items-center justify-center mx-auto mb-3">
                <UserPlus className="w-8 h-8 text-[#64748B]" />
              </div>
              <p className="text-[#64748B]">No family members added yet</p>
              <p className="text-sm text-[#64748B] mt-1">Add family members to grant them app access</p>
            </Card>
          ) : (
            members.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>{member.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[#1E293B]">{member.name}</h4>
                        <Badge variant="outline" className="rounded-full">
                          {member.relation}
                        </Badge>
                      </div>

                      <div className="flex items-center space-x-3 text-sm text-[#64748B] mb-3">
                        {member.phone && (
                          <div className="flex items-center space-x-1">
                            <Phone className="w-3 h-3" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        {member.email && (
                          <div className="flex items-center space-x-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{member.email}</span>
                          </div>
                        )}
                      </div>

                      {/* Permissions Summary */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {member.permissions.qrCodes && (
                          <Badge variant="secondary" className="text-xs">QR Codes</Badge>
                        )}
                        {member.permissions.complaints && (
                          <Badge variant="secondary" className="text-xs">Complaints</Badge>
                        )}
                        {member.permissions.payments && (
                          <Badge variant="secondary" className="text-xs">Payments</Badge>
                        )}
                        {member.permissions.smartHome && (
                          <Badge variant="secondary" className="text-xs">Smart Home</Badge>
                        )}
                        {member.permissions.cameras && (
                          <Badge variant="secondary" className="text-xs">Cameras</Badge>
                        )}
                        {member.permissions.services.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {member.permissions.services.length} Services
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 rounded-lg"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          className="flex-1 h-9 rounded-lg text-[#EF4444] border-[#EF4444] hover:bg-[#EF4444] hover:text-white"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                      </div>
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
