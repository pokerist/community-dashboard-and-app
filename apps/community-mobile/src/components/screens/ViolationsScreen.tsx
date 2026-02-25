import { useState } from "react";
import { ArrowLeft, AlertTriangle, DollarSign, FileText, Camera, X } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { violations, contractorViolations } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";
import { PaymentDialog } from "../common/PaymentDialog";

interface ViolationsScreenProps {
  onBack: () => void;
  user?: any;
}

export function ViolationsScreen({ onBack, user }: ViolationsScreenProps) {
  const isContractor = user?.accountType === "Contractor";
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isAppealDialogOpen, setIsAppealDialogOpen] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<any>(null);
  const [violationsList, setViolationsList] = useState(isContractor ? contractorViolations : violations);

  const [reportForm, setReportForm] = useState({
    type: "",
    location: "",
    description: "",
    photos: [] as string[],
    anonymous: false
  });

  const [appealForm, setAppealForm] = useState({
    reason: "",
    evidence: [] as string[]
  });

  const violationTypes = [
    "Parking Violation",
    "Noise Complaint",
    "Construction Without Permit",
    "Improper Waste Disposal",
    "Common Area Misuse",
    "Pet Violation",
    "Other"
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending Payment": return "bg-[#F59E0B] text-white";
      case "Paid": return "bg-[#10B981] text-white";
      case "Appealed": return "bg-[#3B82F6] text-white";
      case "Cancelled": return "bg-[#64748B] text-white";
      default: return "bg-[#64748B] text-white";
    }
  };

  const handleReportViolation = () => {
    if (!reportForm.type || !reportForm.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    toast.success("Violation report submitted for review");
    setIsReportDialogOpen(false);
    setReportForm({
      type: "",
      location: "",
      description: "",
      photos: [],
      anonymous: false
    });
  };

  const handleAppealViolation = () => {
    if (!appealForm.reason) {
      toast.error("Please provide a reason for your appeal");
      return;
    }

    toast.success("Appeal submitted successfully");
    setIsAppealDialogOpen(false);
    setSelectedViolation(null);
    setAppealForm({ reason: "", evidence: [] });
  };

  const handlePayFine = (violation: any) => {
    setSelectedViolation(violation);
    setShowPaymentDialog(true);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#EF4444] to-[#DC2626] rounded-b-3xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-white">{isContractor ? "Construction Violations" : "Violations"}</h2>
          <div className="w-6" />
        </div>

        <p className="text-white/80 text-sm">
          {isContractor 
            ? "Worker safety and construction compliance violations" 
            : "Manage violations and fines"}
        </p>
      </div>

      {/* Content */}
      <div className="px-6">
        <Tabs defaultValue="my-violations" className="space-y-6">
          {!isContractor && (
            <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl">
              <TabsTrigger value="my-violations" className="rounded-lg">My Violations</TabsTrigger>
              <TabsTrigger value="report" className="rounded-lg">Report Violation</TabsTrigger>
            </TabsList>
          )}

          {/* My Violations Tab */}
          <TabsContent value="my-violations" className="space-y-4">
            {violationsList.length === 0 ? (
              <Card className="p-8 text-center rounded-2xl border-0">
                <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-8 h-8 text-[#10B981]" />
                </div>
                <p className="text-[#1E293B] mb-1">No Violations</p>
                <p className="text-sm text-[#64748B]">You have no recorded violations</p>
              </Card>
            ) : (
              violationsList.map((violation, index) => (
                <motion.div
                  key={violation.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-4 rounded-2xl border-0">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                          <h4 className="text-[#1E293B]">{violation.type}</h4>
                        </div>
                        <p className="text-sm text-[#64748B] mb-2">{violation.description}</p>
                        {isContractor && violation.workerName && (
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-xs text-[#EF4444] bg-[#FEF2F2] px-2 py-1 rounded-full">
                              👷 {violation.workerName}
                            </span>
                          </div>
                        )}
                        {isContractor && violation.location && (
                          <p className="text-xs text-[#64748B] mt-1">📍 {violation.location}</p>
                        )}
                        {isContractor && violation.severity && (
                          <div className="flex items-center space-x-1 mt-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              violation.severity === "High" 
                                ? "bg-[#FEF2F2] text-[#EF4444]" 
                                : violation.severity === "Medium"
                                ? "bg-[#FEF9C3] text-[#F59E0B]"
                                : "bg-[#F0FDF4] text-[#10B981]"
                            }`}>
                              {violation.severity} Severity
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge className={`${getStatusColor(violation.status)} rounded-full text-xs`}>
                        {violation.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between mb-3 p-3 bg-[#F9FAFB] rounded-xl">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-[#64748B]" />
                        <span className="text-sm text-[#64748B]">Fine Amount:</span>
                      </div>
                      <span className="text-[#1E293B]">
                        {violation.currency} {violation.fine.toLocaleString()}
                      </span>
                    </div>

                    {isContractor && violation.reportedBy && (
                      <div className="flex items-center justify-between mb-3 p-3 bg-[#F9FAFB] rounded-xl">
                        <span className="text-sm text-[#64748B]">Reported by:</span>
                        <span className="text-[#1E293B] text-sm">{violation.reportedBy}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-[#64748B] mb-3">
                      <span>Violation ID: {violation.id}</span>
                      <span>{violation.date} {violation.time && `• ${violation.time}`}</span>
                    </div>

                    {isContractor && violation.notes && (
                      <div className="mb-3 p-3 bg-[#FEF9C3]/30 rounded-xl border border-[#F59E0B]/20">
                        <p className="text-xs text-[#92400E]">
                          <span className="font-medium">Note:</span> {violation.notes}
                        </p>
                      </div>
                    )}

                    {violation.evidence && violation.evidence.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-[#64748B] mb-2">Evidence Photos:</p>
                        <div className="flex space-x-2">
                          {violation.evidence.map((photo: string, i: number) => (
                            <div key={i} className="w-16 h-16 rounded-lg bg-[#F9FAFB] flex items-center justify-center">
                              <Camera className="w-4 h-4 text-[#64748B]" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {violation.status === "Pending Payment" && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handlePayFine(violation)}
                          className="flex-1 h-9 rounded-lg bg-[#10B981] hover:bg-[#059669]"
                        >
                          <DollarSign className="w-3 h-3 mr-1" />
                          Pay Fine
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedViolation(violation);
                            setIsAppealDialogOpen(true);
                          }}
                          className="flex-1 h-9 rounded-lg"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          Appeal
                        </Button>
                      </div>
                    )}

                    {violation.status === "Paid" && (
                      <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg p-2 text-xs text-[#10B981] text-center">
                        ✓ Fine paid successfully
                      </div>
                    )}

                    {violation.status === "Appealed" && (
                      <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-lg p-2 text-xs text-[#3B82F6] text-center">
                        📋 Appeal under review
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* Report Violation Tab */}
          <TabsContent value="report">
            <Card className="p-6 rounded-2xl border-0 space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-[#EF4444]/10 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
                </div>
                <h3 className="text-[#1E293B] mb-1">Report a Violation</h3>
                <p className="text-sm text-[#64748B]">Help keep the community safe</p>
              </div>

              <div>
                <Label>Violation Type *</Label>
                <select
                  value={reportForm.type}
                  onChange={(e) => setReportForm({ ...reportForm, type: e.target.value })}
                  className="mt-2 h-12 w-full rounded-xl bg-[#F9FAFB] border-0 px-3"
                >
                  <option value="">Select violation type</option>
                  {violationTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Location/Unit (Optional)</Label>
                <Input
                  value={reportForm.location}
                  onChange={(e) => setReportForm({ ...reportForm, location: e.target.value })}
                  placeholder="e.g., Building B, Parking Area 3"
                  className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Description *</Label>
                <Textarea
                  value={reportForm.description}
                  onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
                  placeholder="Describe the violation in detail..."
                  className="mt-2 min-h-[100px] rounded-xl bg-[#F9FAFB] border-0"
                />
              </div>

              <div>
                <Label>Evidence Photos (Optional)</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-xl border-2 border-dashed border-[#E2E8F0] hover:border-[#EF4444] flex flex-col items-center justify-center cursor-pointer transition-colors"
                    >
                      <Camera className="w-5 h-5 text-[#64748B] mb-1" />
                      <span className="text-xs text-[#64748B]">Upload</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-[#F9FAFB] rounded-xl">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={reportForm.anonymous}
                  onChange={(e) => setReportForm({ ...reportForm, anonymous: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="anonymous" className="text-sm text-[#64748B]">
                  Submit anonymously
                </label>
              </div>

              <Button
                onClick={handleReportViolation}
                className="w-full h-12 rounded-xl bg-[#EF4444] hover:bg-[#DC2626]"
              >
                Submit Report
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Appeal Dialog */}
      <Dialog open={isAppealDialogOpen} onOpenChange={setIsAppealDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appeal Violation</DialogTitle>
            <DialogDescription>
              Submit an appeal for this violation with supporting evidence
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {selectedViolation && (
              <div className="p-3 bg-[#F9FAFB] rounded-xl text-sm">
                <p className="text-[#64748B] mb-1">Violation:</p>
                <p className="text-[#1E293B]">{selectedViolation.type}</p>
                <p className="text-[#64748B] mt-2 mb-1">Fine:</p>
                <p className="text-[#1E293B]">
                  {selectedViolation.currency} {selectedViolation.fine}
                </p>
              </div>
            )}

            <div>
              <Label>Reason for Appeal *</Label>
              <Textarea
                value={appealForm.reason}
                onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                placeholder="Explain why you believe this violation should be reviewed..."
                className="mt-2 min-h-[120px] rounded-xl bg-[#F9FAFB] border-0"
              />
            </div>

            <div>
              <Label>Supporting Evidence (Optional)</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl border-2 border-dashed border-[#E2E8F0] hover:border-[#3B82F6] flex flex-col items-center justify-center cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4 text-[#64748B] mb-1" />
                    <span className="text-xs text-[#64748B]">Upload</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAppealDialogOpen(false);
                  setSelectedViolation(null);
                }}
                className="flex-1 h-11 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAppealViolation}
                className="flex-1 h-11 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB]"
              >
                Submit Appeal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        amount={selectedViolation?.fine || 0}
        currency={selectedViolation?.currency || "EGP"}
        title="Pay Violation Fine"
        description={`Pay fine for ${selectedViolation?.type || "violation"}`}
        billId={selectedViolation?.id}
        onSuccess={() => {
          setShowPaymentDialog(false);
          // Update violation status
          setViolationsList(prevList =>
            prevList.map(v =>
              v.id === selectedViolation?.id
                ? { ...v, status: "Paid" }
                : v
            )
          );
          setSelectedViolation(null);
        }}
      />
    </div>
  );
}
