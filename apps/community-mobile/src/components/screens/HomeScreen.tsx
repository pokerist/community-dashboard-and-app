import { useState } from "react";
import { Menu, ChevronDown, QrCode, Package, Car, Wrench, Sparkles, Bug, Shield, Camera, AlertTriangle, Home as HomeIcon, ChevronRight, Calendar, DollarSign, Building2, Check, Users, HardHat, FileText, MessageSquare, UserPlus, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { BannerCarousel } from "../common/BannerCarousel";
import { Badge } from "../ui/badge";
import { motion, AnimatePresence } from "motion/react";

interface HomeScreenProps {
  user: any;
  currentUnit?: any;
  onMenuOpen: () => void;
  onNavigate: (screen: string, params?: any) => void;
  onUnitChange?: (unitId: string) => void;
}

export function HomeScreen({ user, currentUnit, onMenuOpen, onNavigate, onUnitChange }: HomeScreenProps) {
  const timeOfDay = new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening";
  const [showUnitSelector, setShowUnitSelector] = useState(false);

  const hasMultipleUnits = user?.units && user.units.length > 1;
  const isPreConstruction = user?.unitStatus === "Not Delivered" || user?.accountType === "Not Delivered Owner";
  const isContractor = user?.accountType === "Contractor";

  // Quick Access Actions
  const accessControlActions = [
    { 
      id: "qr-codes", 
      label: "QR Codes", 
      icon: QrCode, 
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-600",
      action: () => onNavigate("qr") 
    },
    { 
      id: "payments", 
      label: "Payments", 
      icon: DollarSign, 
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-500/10",
      iconColor: "text-green-600",
      action: () => onNavigate("payments") 
    },
    { 
      id: "complaints", 
      label: "Complaints", 
      icon: MessageSquare, 
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-600",
      action: () => onNavigate("complaints") 
    },
  ];

  // Services Actions
  const servicesActions = [
    { 
      id: "maintenance", 
      label: "Maintenance", 
      icon: Wrench, 
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-600",
      action: () => onNavigate("services", { service: "maintenance" }) 
    },
    { 
      id: "cleaning", 
      label: "Cleaning", 
      icon: Sparkles, 
      bgColor: "bg-cyan-500/10",
      iconColor: "text-cyan-600",
      action: () => onNavigate("services", { service: "cleaning" }) 
    },
    { 
      id: "pest", 
      label: "Pest Control", 
      icon: Bug, 
      bgColor: "bg-pink-500/10",
      iconColor: "text-pink-600",
      action: () => onNavigate("services", { service: "pest" }) 
    },
  ];

  // Security Actions
  const securityActions = [
    { 
      id: "emergency", 
      label: "Emergency", 
      icon: Shield, 
      bgColor: "bg-red-500/10",
      iconColor: "text-red-600",
      action: () => onNavigate("emergency") 
    },
    { 
      id: "cameras", 
      label: "Cameras", 
      icon: Camera, 
      bgColor: "bg-indigo-500/10",
      iconColor: "text-indigo-600",
      action: () => onNavigate("cameras") 
    },
    { 
      id: "violations", 
      label: "Violations", 
      icon: AlertTriangle, 
      bgColor: "bg-amber-500/10",
      iconColor: "text-amber-600",
      action: () => onNavigate("violations") 
    },
  ];

  // Contractor Quick Actions
  const contractorActions = [
    { 
      id: "workers", 
      label: "My Workers", 
      icon: HardHat, 
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-600",
      action: () => onNavigate("workers", { contractorId: user?.id }) 
    },
    { 
      id: "violations", 
      label: "Violations", 
      icon: AlertTriangle, 
      bgColor: "bg-red-500/10",
      iconColor: "text-red-600",
      action: () => onNavigate("violations") 
    },
    { 
      id: "permits", 
      label: "QR Codes", 
      icon: QrCode, 
      bgColor: "bg-green-500/10",
      iconColor: "text-green-600",
      action: () => onNavigate("qr", { tab: "workers" }) 
    },
    { 
      id: "support", 
      label: "Support", 
      icon: MessageSquare, 
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-600",
      action: () => onNavigate("chat") 
    },
  ];

  // Community Updates (renamed from Recent Activity)
  const communityUpdates = isContractor ? [
    { id: 1, title: "Villa 24 - Finishing work approved", time: "2 hours ago", type: "success", icon: "✓" },
    { id: 2, title: "New material delivery scheduled", time: "5 hours ago", type: "info", icon: "📦" },
    { id: 3, title: "Site inspection completed - Phase 2", time: "1 day ago", type: "success", icon: "✓" },
    { id: 4, title: "Safety protocol update required", time: "2 days ago", type: "warning", icon: "⚠️" },
  ] : [
    { id: 1, title: "Pool Maintenance Complete", time: "2 hours ago", type: "success", icon: "✓" },
    { id: 2, title: "New Security Protocol", time: "1 day ago", type: "info", icon: "ℹ" },
    { id: 3, title: "Community Event Next Week", time: "3 days ago", type: "event", icon: "📅" },
  ];

  // Upcoming Payments
  const upcomingPayments = [
    {
      id: 1,
      title: "Service Charge",
      amount: 2500,
      dueDate: "2025-03-30",
      status: "due_soon"
    },
    {
      id: 2,
      title: "Water Bill",
      amount: 120,
      dueDate: "2025-03-25",
      status: "pending"
    }
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] rounded-b-3xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onMenuOpen}>
            <Menu className="w-6 h-6 text-white" />
          </button>
          
          {hasMultipleUnits ? (
            <div className="relative">
              <button
                onClick={() => setShowUnitSelector(!showUnitSelector)}
                className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 hover:bg-white/20 transition-colors"
              >
                <Building2 className="w-4 h-4 text-white" />
                <span className="text-white text-sm">{user.unit}</span>
                <ChevronDown className={`w-4 h-4 text-white transition-transform ${showUnitSelector ? 'rotate-180' : ''}`} />
              </button>

              {/* Unit Selector Dropdown */}
              <AnimatePresence>
                {showUnitSelector && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl overflow-hidden z-50"
                  >
                    {user.units.map((unit: any) => (
                      <button
                        key={unit.id}
                        onClick={() => {
                          onUnitChange?.(unit.id);
                          setShowUnitSelector(false);
                        }}
                        className={`w-full p-4 text-left hover:bg-[#F9FAFB] transition-colors border-b last:border-b-0 ${
                          currentUnit?.id === unit.id ? 'bg-[#2a3e35]/5' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <p className="text-[#1E293B]">{unit.number}</p>
                              {currentUnit?.id === unit.id && (
                                <Badge className="bg-[#2a3e35] text-white text-xs h-5 px-2">
                                  <Check className="w-3 h-3 mr-1" />
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-[#64748B] mb-2">{unit.compound}</p>
                            <div className="flex items-center space-x-3 text-xs text-[#64748B]">
                              <span>{unit.type}</span>
                              <span>•</span>
                              <span>{unit.area}</span>
                              {unit.isRented && (
                                <>
                                  <span>•</span>
                                  <Badge className="bg-[#10B981]/10 text-[#10B981] text-xs h-5">
                                    Rented
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <span className="text-white text-sm">{user.unit}</span>
            </div>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-white mb-1">Good {timeOfDay}, {user.name.split(" ")[0]} 👋</h2>
          <div className="flex items-center space-x-2">
            <p className="text-white/80">Welcome to</p>
            <span className="text-[#c9a961] tracking-wider" style={{ fontWeight: '400' }}>AlKarma Gates</span>
          </div>
        </div>

        {/* Banner Carousel */}
        <BannerCarousel />
      </div>

      {/* Content */}
      <div className="px-6 mt-6 space-y-6">
        {/* Not Delivered Owner View */}
        {isPreConstruction ? (
          <>
            {/* Construction Progress */}
            <Card className="p-6 rounded-2xl border-0 bg-gradient-to-br from-[#2a3e35] to-[#1f2e27]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white mb-1">Construction Progress</h3>
                  <p className="text-white/60 text-sm">Your unit is under construction</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <HardHat className="w-6 h-6 text-[#c9a961]" />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">Overall Progress</span>
                  <span className="text-white">65%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div className="bg-[#c9a961] h-2 rounded-full" style={{ width: '65%' }} />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                      <span className="text-white text-sm">Foundation</span>
                    </div>
                    <p className="text-white/60 text-xs">Complete</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <Clock className="w-4 h-4 text-[#F59E0B]" />
                      <span className="text-white text-sm">Structure</span>
                    </div>
                    <p className="text-white/60 text-xs">In Progress</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment Schedule */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#1E293B]">Payment Schedule</h3>
                <button 
                  onClick={() => onNavigate("payments")}
                  className="text-[#2a3e35] text-sm hover:underline flex items-center"
                >
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
              
              <div className="space-y-3">
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-[#F59E0B]" />
                      </div>
                      <div>
                        <p className="text-[#1E293B]">3rd Installment</p>
                        <div className="flex items-center space-x-2 text-sm text-[#64748B]">
                          <Calendar className="w-3 h-3" />
                          <span>Due March 30</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#1E293B]">EGP 150,000</p>
                      <Badge className="bg-[#F59E0B]/10 text-[#F59E0B] text-xs mt-1">
                        Upcoming
                      </Badge>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 rounded-2xl border-0 bg-[#F9FAFB]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                      </div>
                      <div>
                        <p className="text-[#1E293B]">2nd Installment</p>
                        <div className="flex items-center space-x-2 text-sm text-[#64748B]">
                          <span>Paid January 15</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#64748B]">EGP 150,000</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Quick Actions for Not Delivered Owner */}
            <div>
              <h3 className="text-[#1E293B] mb-4">Quick Actions</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onNavigate("schedule-meeting")}
                  className="p-4 rounded-2xl border-0 bg-white hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="text-[#1E293B] text-sm">Schedule Meeting</p>
                  <p className="text-xs text-[#64748B] mt-1">With management</p>
                </button>

                <button
                  onClick={() => onNavigate("delegation")}
                  className="p-4 rounded-2xl border-0 bg-white hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-3">
                    <UserPlus className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-[#1E293B] text-sm">Delegation</p>
                  <p className="text-xs text-[#64748B] mt-1">Add delegated person</p>
                </button>

                <button
                  onClick={() => onNavigate("complaints")}
                  className="p-4 rounded-2xl border-0 bg-white hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-[#1E293B] text-sm">Submit Complaint</p>
                  <p className="text-xs text-[#64748B] mt-1">Report issue</p>
                </button>

                <button
                  onClick={() => onNavigate("chat")}
                  className="p-4 rounded-2xl border-0 bg-white hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6 text-cyan-600" />
                  </div>
                  <p className="text-[#1E293B] text-sm">Unit Documents</p>
                  <p className="text-xs text-[#64748B] mt-1">View contracts</p>
                </button>
              </div>
            </div>

            {/* Recent Updates */}
            <div>
              <h3 className="text-[#1E293B] mb-4">Recent Updates</h3>
              
              <div className="space-y-3">
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-[#10B981]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#1E293B] text-sm">Construction milestone reached</p>
                      <p className="text-xs text-[#64748B] mt-1">Second floor structure completed - 2 days ago</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[#3B82F6]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#1E293B] text-sm">New document available</p>
                      <p className="text-xs text-[#64748B] mt-1">Construction progress report - 5 days ago</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-[#F59E0B]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#1E293B] text-sm">Payment reminder</p>
                      <p className="text-xs text-[#64748B] mt-1">3rd installment due in 17 days - 1 week ago</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Regular User View (Delivered Units) */}
            
            {/* 1. Quick Access Section */}
            {user.accountType !== "Contractor" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#1E293B]">Quick Access</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {accessControlActions.map((action, index) => {
                    const Icon = action.icon;
                    return (
                      <motion.button
                        key={action.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={action.action}
                        className="flex flex-col items-center"
                      >
                        <div className={`w-full aspect-square rounded-2xl ${action.bgColor} flex items-center justify-center mb-2 hover:scale-105 transition-transform`}>
                          <Icon className={`w-8 h-8 ${action.iconColor}`} />
                        </div>
                        <span className="text-xs text-[#64748B] text-center">{action.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Community Updates */}
            {user.accountType !== "Contractor" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#1E293B]">Community Updates</h3>
                </div>
                
                <div className="space-y-3">
                  {communityUpdates.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="p-4 rounded-2xl border-0">
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            activity.type === "success" ? "bg-[#10B981]/10" :
                            activity.type === "info" ? "bg-[#3B82F6]/10" :
                            "bg-[#F59E0B]/10"
                          }`}>
                            <span className="text-sm">{activity.icon}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-[#1E293B] text-sm">{activity.title}</p>
                            <p className="text-xs text-[#64748B] mt-1">{activity.time}</p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Upcoming Payments */}
            {user.accountType !== "Contractor" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#1E293B]">Upcoming Payments</h3>
                  <button 
                    onClick={() => onNavigate("payments")}
                    className="text-[#2a3e35] text-sm hover:underline flex items-center"
                  >
                    View All
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {upcomingPayments.map((payment, index) => (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="p-4 rounded-2xl border-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                              <DollarSign className="w-5 h-5 text-[#F59E0B]" />
                            </div>
                            <div>
                              <p className="text-[#1E293B]">{payment.title}</p>
                              <div className="flex items-center space-x-2 text-sm text-[#64748B]">
                                <Calendar className="w-3 h-3" />
                                <span>Due {new Date(payment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[#1E293B]">EGP {payment.amount}</p>
                            <Button
                              onClick={() => onNavigate("payments")}
                              size="sm"
                              className="h-7 text-xs rounded-lg bg-[#2a3e35] hover:bg-[#1f2e27] mt-1"
                            >
                              Pay Now
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}



        {/* Contractor Section */}
        {isContractor && (
          <>
            {/* Contractor Info Card */}
            <Card className="p-4 rounded-2xl border-0 bg-gradient-to-br from-[#2a3e35] to-[#1f2e27]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white mb-1">Mahmoud Kamal</h3>
                  <p className="text-white/60 text-sm">Interior Designer</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                  <HardHat className="w-6 h-6 text-[#c9a961]" />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center space-x-1 mb-1">
                    <Users className="w-3 h-3 text-white/80" />
                    <span className="text-white/80 text-xs">Workers</span>
                  </div>
                  <p className="text-white">{user.workers?.length || 0}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center space-x-1 mb-1">
                    <Calendar className="w-3 h-3 text-white/80" />
                    <span className="text-white/80 text-xs">Valid Until</span>
                  </div>
                  <p className="text-white text-xs">Dec 2025</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center space-x-1 mb-1">
                    <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                    <span className="text-white/80 text-xs">Status</span>
                  </div>
                  <p className="text-[#10B981] text-xs">Active</p>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <div>
              <h3 className="text-[#1E293B] mb-4">Quick Actions</h3>
              
              <div className="grid grid-cols-2 gap-3">
                {contractorActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={action.action}
                      className="p-4 rounded-2xl border-0 bg-white hover:shadow-md transition-all text-left"
                    >
                      <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center mb-3`}>
                        <Icon className={`w-6 h-6 ${action.iconColor}`} />
                      </div>
                      <p className="text-[#1E293B] text-sm">{action.label}</p>
                      <p className="text-xs text-[#64748B] mt-1">
                        {action.id === "workers" && `${user.workers?.length || 0} active`}
                        {action.id === "violations" && "View all"}
                        {action.id === "permits" && "Manage access"}
                        {action.id === "support" && "Get help"}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Recent Violations Alert */}
            <Card className="p-4 rounded-2xl border-0 border-l-4 border-l-amber-500 bg-amber-50">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-[#1E293B] mb-1">Active Violations</h4>
                  <p className="text-sm text-[#64748B] mb-3">
                    You have 2 pending violations that require attention
                  </p>
                  <Button
                    size="sm"
                    onClick={() => onNavigate("violations")}
                    className="h-8 rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Review Violations
                  </Button>
                </div>
              </div>
            </Card>

            {/* Emergency Contact */}
            <div>
              <h3 className="text-[#1E293B] mb-4">Emergency & Support</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onNavigate("emergency")}
                  className="p-4 rounded-2xl border-0 bg-white hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                    <Shield className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-[#1E293B] text-sm">Emergency</p>
                  <p className="text-xs text-[#64748B] mt-1">Quick access</p>
                </button>

                <button
                  onClick={() => onNavigate("chat")}
                  className="p-4 rounded-2xl border-0 bg-white hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-[#1E293B] text-sm">Support Chat</p>
                  <p className="text-xs text-[#64748B] mt-1">Get help</p>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Smart Home Section (if available, not contractor, and not not-delivered) */}
        {user.hasSmartHome && user.accountType !== "Contractor" && !isPreConstruction && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => onNavigate("smarthome")}
              className="w-full"
            >
              <Card className="p-4 rounded-2xl border-0 bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <HomeIcon className="w-6 h-6 text-[#c9a961]" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-white mb-1">Smart Home Control</h4>
                      <p className="text-sm text-white/70">4 devices active</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/70" />
                </div>
              </Card>
            </button>
          </motion.div>
        )}

        {/* Upcoming Payments - Not for contractors and not not-delivered (they have payment schedule above) */}
        {upcomingPayments.length > 0 && user.accountType !== "Contractor" && !isPreConstruction && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#1E293B]">Upcoming Payments</h3>
              <button 
                onClick={() => onNavigate("payments")}
                className="text-[#2a3e35] text-sm hover:underline flex items-center"
              >
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
            
            <div className="space-y-3">
              {upcomingPayments.map((payment, index) => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-4 rounded-2xl border-0 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-[#F59E0B]" />
                        </div>
                        <div>
                          <p className="text-[#1E293B]">{payment.title}</p>
                          <div className="flex items-center space-x-2 text-sm text-[#64748B]">
                            <Calendar className="w-3 h-3" />
                            <span>Due {payment.dueDate}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[#1E293B]">{payment.currency} {payment.amount}</p>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate("payments");
                          }}
                          className="h-7 text-xs rounded-lg bg-[#10B981] hover:bg-[#059669] mt-1"
                        >
                          Pay Now
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}


          </>
        )}
      </div>
    </div>
  );
}
