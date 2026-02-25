import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CreditCard, FileText, Download, Calendar, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner@2.0.3";

interface UtilityManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  utilityType: "electricity" | "water" | "internet" | null;
  user: any;
}

export function UtilityManagementDialog({ isOpen, onClose, utilityType, user }: UtilityManagementDialogProps) {
  const [activeTab, setActiveTab] = useState("current");

  const utilityInfo = {
    electricity: {
      icon: "⚡",
      name: "Electricity Bills",
      provider: "Egyptian Electricity Holding Company",
      accountNumber: "EL-" + user.unit?.replace(/[^0-9]/g, '') || "12345"
    },
    water: {
      icon: "💧",
      name: "Water Bills",
      provider: "Water & Wastewater Company",
      accountNumber: "WT-" + user.unit?.replace(/[^0-9]/g, '') || "12345"
    },
    internet: {
      icon: "📡",
      name: "Internet Service",
      provider: "WE - Telecom Egypt",
      accountNumber: "IN-" + user.unit?.replace(/[^0-9]/g, '') || "12345"
    }
  };

  const currentUtility = utilityType ? utilityInfo[utilityType] : null;

  // Mock bills data
  const mockBills = [
    {
      id: "BILL-2025-03",
      month: "March 2025",
      amount: utilityType === "electricity" ? 450 : utilityType === "water" ? 120 : 299,
      dueDate: "2025-03-25",
      status: "pending",
      consumption: utilityType === "electricity" ? "380 kWh" : utilityType === "water" ? "15 m³" : "100 GB"
    },
    {
      id: "BILL-2025-02",
      month: "February 2025",
      amount: utilityType === "electricity" ? 425 : utilityType === "water" ? 115 : 299,
      dueDate: "2025-02-25",
      status: "paid",
      paidDate: "2025-02-20",
      consumption: utilityType === "electricity" ? "360 kWh" : utilityType === "water" ? "14 m³" : "95 GB"
    },
    {
      id: "BILL-2025-01",
      month: "January 2025",
      amount: utilityType === "electricity" ? 480 : utilityType === "water" ? 125 : 299,
      dueDate: "2025-01-25",
      status: "paid",
      paidDate: "2025-01-18",
      consumption: utilityType === "electricity" ? "410 kWh" : utilityType === "water" ? "16 m³" : "110 GB"
    }
  ];

  const handlePayBill = (billId: string, amount: number) => {
    toast.success(`Payment of ${amount} EGP initiated successfully!`);
    // Here you would integrate with payment gateway
  };

  const handleDownloadBill = (billId: string) => {
    toast.success("Bill downloaded successfully!");
    // Here you would trigger PDF download
  };

  if (!currentUtility) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-4 rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <span className="text-3xl">{currentUtility.icon}</span>
            <span className="text-[#1E293B]">{currentUtility.name}</span>
          </DialogTitle>
          <DialogDescription className="text-[#64748B]">
            Manage your {utilityType} service and bills
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Account Info */}
          <Card className="p-4 bg-gradient-to-br from-[#2a3e35]/5 to-[#2a3e35]/10 border-0">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-[#64748B]">Account Number</span>
                <span className="text-sm text-[#1E293B] font-mono">{currentUtility.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#64748B]">Unit</span>
                <span className="text-sm text-[#1E293B]">{user.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[#64748B]">Provider</span>
                <span className="text-sm text-[#1E293B]">{currentUtility.provider}</span>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-[#F9FAFB] rounded-xl p-1">
              <TabsTrigger 
                value="current" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Current Bill
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="mt-4 space-y-4">
              {/* Current Bill */}
              <Card className="p-4 border-2 border-[#c9a961]/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-[#1E293B]">{mockBills[0].month}</h4>
                    <p className="text-sm text-[#64748B]">Consumption: {mockBills[0].consumption}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl text-[#1E293B]">{mockBills[0].amount} <span className="text-sm">EGP</span></p>
                    <p className="text-xs text-[#64748B]">Due: {mockBills[0].dueDate}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 px-4 bg-[#F59E0B]/10 rounded-xl mb-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
                    <span className="text-sm text-[#F59E0B]">Payment Due Soon</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleDownloadBill(mockBills[0].id)}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl border-[#E2E8F0]"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    onClick={() => handlePayBill(mockBills[0].id, mockBills[0].amount)}
                    className="flex-1 h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay Now
                  </Button>
                </div>
              </Card>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 bg-[#F9FAFB] border-0">
                  <p className="text-xs text-[#64748B] mb-1">Avg. Monthly</p>
                  <p className="text-lg text-[#1E293B]">{Math.round((mockBills[0].amount + mockBills[1].amount + mockBills[2].amount) / 3)} EGP</p>
                </Card>
                <Card className="p-4 bg-[#F9FAFB] border-0">
                  <p className="text-xs text-[#64748B] mb-1">Last Payment</p>
                  <p className="text-lg text-[#1E293B]">{mockBills[1].amount} EGP</p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-3">
              {mockBills.map((bill) => (
                <Card key={bill.id} className="p-4 border-0 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-[#1E293B] mb-1">{bill.month}</h4>
                      <p className="text-xs text-[#64748B]">{bill.consumption}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg text-[#1E293B]">{bill.amount} EGP</p>
                      {bill.status === "paid" ? (
                        <div className="flex items-center space-x-1 text-[#10B981] text-xs">
                          <CheckCircle className="w-3 h-3" />
                          <span>Paid</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1 text-[#F59E0B] text-xs">
                          <AlertCircle className="w-3 h-3" />
                          <span>Pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {bill.status === "paid" && (
                    <p className="text-xs text-[#64748B]">Paid on {bill.paidDate}</p>
                  )}

                  <Button
                    onClick={() => handleDownloadBill(bill.id)}
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 h-10 rounded-lg border-[#E2E8F0]"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Bill
                  </Button>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
