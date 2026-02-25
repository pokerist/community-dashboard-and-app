import { useState } from "react";
import { Card } from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { 
  User, 
  Phone, 
  Mail, 
  Home, 
  CreditCard, 
  Users, 
  Shield, 
  Globe, 
  Fingerprint,
  ChevronRight,
  Edit,
  Plus
} from "lucide-react";
import { familyMembers, authorizedPersons, users } from "../../data/mockData";

interface ProfileScreenProps {
  user: any;
  currentUnit?: any;
  onLogout: () => void;
  onNavigate?: (screen: string, params?: any) => void;
}

export function ProfileScreen({ user, currentUnit, onLogout, onNavigate }: ProfileScreenProps) {
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  
  const isPreConstruction = user.unitStatus === "Not Delivered" || user.accountType === "Not Delivered Owner";
  const isContractor = user.accountType === "Contractor";
  
  // Filter family members and authorized persons based on user
  const userFamilyMembers = (user.accountType === "Owner" || user.accountType === "Tenant") && !isPreConstruction
    ? familyMembers.filter((m: any) => m.parentUserId === user.id)
    : [];
  
  const userAuthorizedPersons = user.accountType === "Owner" && !isPreConstruction
    ? authorizedPersons.filter((p: any) => p.parentUserId === user.id)
    : [];
  const [language, setLanguage] = useState("en");

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] p-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center space-x-4 mb-6">
          <Avatar className="w-20 h-20 border-4 border-[#c9a961]">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className="bg-[#c9a961] text-white text-2xl">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-white mb-1">{user.name}</h2>
            <p className="text-[#c9a961] text-sm tracking-wide">{user.role}</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-[#c9a961]/20 backdrop-blur-sm flex items-center justify-center hover:bg-[#c9a961]/30 transition-colors">
            <Edit className="w-5 h-5 text-[#c9a961]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {isContractor ? (
            <>
              <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
                <p className="text-white/60 text-xs mb-1">License</p>
                <p className="text-[#c9a961] text-sm tracking-wide">{user.license}</p>
              </Card>
              <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
                <p className="text-white/60 text-xs mb-1">Status</p>
                <p className="text-white text-sm">{user.approvalStatus}</p>
              </Card>
            </>
          ) : (
            <>
              <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
                <p className="text-white/60 text-xs mb-1">
                  {user.units && user.units.length > 1 ? `Current Unit (${user.units.length} total)` : 'Unit'}
                </p>
                <p className="text-[#c9a961] text-sm tracking-wide">{user.unit}</p>
              </Card>
              <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
                <p className="text-white/60 text-xs mb-1">Status</p>
                <p className="text-white text-sm">{user.unitStatus}</p>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Personal Information */}
      <div className="px-6 mt-6">
        <h3 className="text-[#1E293B] mb-4">Personal Information</h3>
        <Card className="p-4 bg-white rounded-2xl shadow-sm border-0 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center">
              <Mail className="w-5 h-5 text-[#64748B]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#64748B]">Email</p>
              <p className="text-[#1E293B]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center">
              <Phone className="w-5 h-5 text-[#64748B]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#64748B]">Phone</p>
              <p className="text-[#1E293B]">{user.phone}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[#64748B]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#64748B]">National ID</p>
              <p className="text-[#1E293B]">{user.nationalId}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center">
              <Home className="w-5 h-5 text-[#64748B]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#64748B]">Compound</p>
              <p className="text-[#1E293B]">{user.compound}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* My Properties (if multiple units) */}
      {user.units && user.units.length > 1 && (
        <div className="px-6 mt-6">
          <h3 className="text-[#1E293B] mb-4">My Properties</h3>
          <div className="space-y-3">
            {user.units.map((unit: any) => (
              <Card 
                key={unit.id} 
                className={`p-4 bg-white rounded-2xl shadow-sm border-0 ${
                  currentUnit?.id === unit.id ? 'border-2 border-[#2a3e35]' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-[#1E293B]">{unit.number}</h4>
                      {currentUnit?.id === unit.id && (
                        <span className="px-2 py-0.5 bg-[#2a3e35] text-white text-xs rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#64748B]">{unit.compound}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-xs ${
                    unit.status === 'Delivered' 
                      ? 'bg-[#10B981]/10 text-[#10B981]' 
                      : 'bg-[#F59E0B]/10 text-[#F59E0B]'
                  }`}>
                    {unit.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[#64748B]">Type</p>
                    <p className="text-[#1E293B]">{unit.type}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Area</p>
                    <p className="text-[#1E293B]">{unit.area}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B]">Status</p>
                    {unit.isRented ? (
                      <p className="text-[#10B981]">Rented</p>
                    ) : (
                      <p className="text-[#1E293B]">Owner Use</p>
                    )}
                  </div>
                </div>

                {unit.isRented && unit.tenantName && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-[#64748B] mb-1">Current Tenant</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#1E293B]">{unit.tenantName}</p>
                      <button 
                        onClick={() => onNavigate?.('lease')}
                        className="text-xs text-[#2a3e35] hover:underline"
                      >
                        Manage Lease →
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Family Members - Owner, Tenant only (not Not Delivered Owner) */}
      {(user.accountType === "Owner" || user.accountType === "Tenant") && !isPreConstruction && (
        <div className="px-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#1E293B]">Family Members</h3>
            <button 
              onClick={() => onNavigate?.("family")}
              className="w-8 h-8 rounded-full bg-[#2a3e35] flex items-center justify-center hover:bg-[#1f2e27] transition-colors"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="space-y-3">
            {userFamilyMembers.slice(0, 2).map((member) => (
              <Card 
                key={member.id} 
                onClick={() => onNavigate?.("family")}
                className="p-4 bg-white rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[#1E293B]">{member.name}</p>
                      <p className="text-sm text-[#64748B]">{member.relation}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#64748B]" />
                </div>
              </Card>
            ))}
            {userFamilyMembers.length > 2 && (
              <button
                onClick={() => onNavigate?.("family")}
                className="w-full p-3 text-center text-[#2a3e35] text-sm hover:bg-[#F9FAFB] rounded-xl transition-colors"
              >
                View All ({userFamilyMembers.length})
              </button>
            )}
            {userFamilyMembers.length === 0 && (
              <Card className="p-6 text-center bg-[#F9FAFB]">
                <p className="text-sm text-[#64748B]">No family members added yet</p>
              </Card>
            )}
          </div>
        </div>
      )}



      {/* Workers Management - Contractor only */}
      {user.accountType === "Contractor" && (
        <div className="px-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#1E293B]">My Workers</h3>
          </div>
          <button
            onClick={() => {
              // For contractor, pass their own ID to see their workers
              if (onNavigate) {
                onNavigate("workers", { contractorId: user.id });
              }
            }}
            className="w-full"
          >
            <Card className="p-4 bg-white rounded-2xl shadow-sm border-0 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#c9a961]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#c9a961]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[#1E293B]">Manage Workers</p>
                    <p className="text-sm text-[#64748B]">Add and manage your workers</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#64748B]" />
              </div>
            </Card>
          </button>
        </div>
      )}

      {/* Lease Management (Owner only) */}
      {user.role === "Owner" && user.unitStatus === "Delivered" && (
        <div className="px-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#1E293B]">Lease Management</h3>
          </div>
          <button
            onClick={() => onNavigate?.("lease")}
            className="w-full"
          >
            <Card className="p-4 bg-white rounded-2xl shadow-sm border-0 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                    <Home className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[#1E293B]">Manage Tenants</p>
                    <p className="text-sm text-[#64748B]">Add and manage property leases</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#64748B]" />
              </div>
            </Card>
          </button>
        </div>
      )}

      {/* Settings */}
      <div className="px-6 mt-6">
        <h3 className="text-[#1E293B] mb-4">Settings</h3>
        <Card className="p-4 bg-white rounded-2xl shadow-sm border-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center">
                <Fingerprint className="w-5 h-5 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[#1E293B]">Biometric Login</p>
                <p className="text-xs text-[#64748B]">Use Face ID or Fingerprint</p>
              </div>
            </div>
            <Switch checked={biometricEnabled} onCheckedChange={setBiometricEnabled} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#F9FAFB] flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#64748B]" />
              </div>
              <div>
                <p className="text-[#1E293B]">Language</p>
                <p className="text-xs text-[#64748B]">English</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#64748B]" />
          </div>
        </Card>
      </div>

      {/* Logout Button */}
      <div className="px-6 mt-6 pb-6">
        <Button
          onClick={onLogout}
          variant="destructive"
          className="w-full h-12 rounded-xl"
        >
          Logout
        </Button>
      </div>
    </div>
  );
}
