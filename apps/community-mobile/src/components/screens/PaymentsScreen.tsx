import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { CreditCard, Download, Calendar, DollarSign } from "lucide-react";
import { bills } from "../../data/mockData";
import { PaymentDialog } from "../common/PaymentDialog";
import { toast } from "sonner@2.0.3";

interface PaymentsScreenProps {
  onBack: () => void;
}

export function PaymentsScreen({ onBack }: PaymentsScreenProps) {
  const [activeTab, setActiveTab] = useState("unpaid");
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [payAllMode, setPayAllMode] = useState(false);

  const unpaidBills = bills.filter(b => b.status === "Unpaid");
  const paidBills = bills.filter(b => b.status === "Paid");
  const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + bill.amount, 0);

  const getBillIcon = (type: string) => {
    switch (type) {
      case "Electricity":
        return "⚡";
      case "Water":
        return "💧";
      case "Maintenance Fee":
        return "🏠";
      default:
        return "💳";
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] p-6 rounded-b-3xl shadow-lg">
        <button onClick={onBack} className="text-white/80 mb-4">
          ← Back
        </button>
        <h2 className="text-white mb-2">Payments & Bills</h2>
        <p className="text-white/80 mb-6">Manage your financial obligations</p>

        {/* Total Unpaid */}
        <Card className="p-4 bg-white/10 backdrop-blur-sm border-0 rounded-2xl">
          <p className="text-white/80 text-sm mb-1">Total Outstanding</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-white text-3xl">{totalUnpaid.toLocaleString()}</span>
            <span className="text-white/80">EGP</span>
          </div>
          <Button 
            onClick={() => {
              setPayAllMode(true);
              setShowPaymentDialog(true);
            }}
            className="w-full mt-4 h-10 rounded-xl bg-white text-[#2a3e35] hover:bg-white/90"
          >
            Pay All Bills
          </Button>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6 mt-6">
        <TabsList className="grid w-full grid-cols-2 bg-white rounded-2xl p-1">
          <TabsTrigger value="unpaid" className="rounded-xl">
            Unpaid ({unpaidBills.length})
          </TabsTrigger>
          <TabsTrigger value="paid" className="rounded-xl">
            Paid ({paidBills.length})
          </TabsTrigger>
        </TabsList>

        {/* Unpaid Bills Tab */}
        <TabsContent value="unpaid" className="mt-6 space-y-4">
          {unpaidBills.map((bill) => (
            <Card key={bill.id} className="p-4 bg-white rounded-2xl shadow-sm border-0">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EF4444]/10 to-[#F59E0B]/10 flex items-center justify-center text-2xl">
                  {getBillIcon(bill.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-[#1E293B] mb-1">{bill.type}</h4>
                      <p className="text-sm text-[#64748B]">{bill.id}</p>
                    </div>
                    <Badge className="bg-[#EF4444]/10 text-[#EF4444]">
                      {bill.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between mt-3 mb-3">
                    <div className="flex items-center space-x-2 text-sm text-[#64748B]">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {bill.dueDate}</span>
                    </div>
                    <p className="text-[#2a3e35]">{bill.currency} {bill.amount.toLocaleString()}</p>
                  </div>

                  <Button 
                    onClick={() => {
                      setSelectedBill(bill);
                      setPayAllMode(false);
                      setShowPaymentDialog(true);
                    }}
                    className="w-full h-10 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27]"
                  >
                    Pay Now
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Paid Bills Tab */}
        <TabsContent value="paid" className="mt-6 space-y-4">
          {paidBills.map((bill) => (
            <Card key={bill.id} className="p-4 bg-white rounded-2xl shadow-sm border-0">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B981]/10 to-[#00B386]/10 flex items-center justify-center text-2xl">
                  {getBillIcon(bill.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-[#1E293B] mb-1">{bill.type}</h4>
                      <p className="text-sm text-[#64748B]">{bill.id}</p>
                    </div>
                    <Badge className="bg-[#10B981]/10 text-[#10B981]">
                      {bill.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm text-[#64748B]">
                      <p>Paid on: {bill.paidDate}</p>
                    </div>
                    <p className="text-[#64748B]">{bill.currency} {bill.amount.toLocaleString()}</p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.success("Receipt downloaded successfully!", {
                        description: `${bill.type} receipt saved to downloads`
                      });
                    }}
                    className="w-full h-10 rounded-xl mt-3"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Receipt
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Payment Methods */}
      <div className="px-6 mt-6">
        <h3 className="text-[#1E293B] mb-4">Payment Methods</h3>
        <Card className="p-4 bg-white rounded-2xl shadow-sm border-0">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[#1E293B] mb-1">Credit/Debit Card</p>
              <p className="text-sm text-[#64748B]">Visa, MasterCard, Meeza</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        amount={payAllMode ? totalUnpaid : (selectedBill?.amount || 0)}
        currency={selectedBill?.currency || "EGP"}
        title={payAllMode ? "Pay All Bills" : `Pay ${selectedBill?.type || "Bill"}`}
        description={payAllMode 
          ? `Complete payment for ${unpaidBills.length} outstanding bills`
          : `Bill ID: ${selectedBill?.id || "N/A"}`
        }
        billId={selectedBill?.id}
        onSuccess={() => {
          setShowPaymentDialog(false);
          setSelectedBill(null);
          setPayAllMode(false);
          // In a real app, this would update the bills list
        }}
      />
    </div>
  );
}
