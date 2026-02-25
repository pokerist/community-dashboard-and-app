import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Plus, ChevronRight, Upload } from "lucide-react";
import { complaints, preConstructionComplaints } from "../../data/mockData";
import { toast } from "sonner@2.0.3";

interface ComplaintsScreenProps {
  user?: any;
  onBack: () => void;
}

export function ComplaintsScreen({ user, onBack }: ComplaintsScreenProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [complaintType, setComplaintType] = useState("");
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  
  const isPreConstruction = user?.unitStatus === "Not Delivered" || user?.accountType === "Not Delivered Owner";

  // Use appropriate complaints based on user type
  const displayedComplaints = isPreConstruction ? preConstructionComplaints : complaints;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Resolved":
        return "bg-[#10B981]/10 text-[#10B981]";
      case "Reviewing":
        return "bg-[#F59E0B]/10 text-[#F59E0B]";
      case "Submitted":
        return "bg-[#2a3e35]/10 text-[#2a3e35]";
      default:
        return "bg-[#64748B]/10 text-[#64748B]";
    }
  };

  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!complaintType || !complaintSubject || !complaintDescription) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Simulate complaint submission
    toast.success("Complaint submitted successfully!", {
      description: `Your complaint has been registered with ID: CMP-${isPreConstruction ? 'PC-' : ''}2025-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`
    });

    // Reset form
    setComplaintType("");
    setComplaintSubject("");
    setComplaintDescription("");
    setPriority("medium");
    setShowDialog(false);
  };

  // Complaint types based on user type
  const complaintTypes = isPreConstruction 
    ? [
        { value: "construction-delay", label: "Construction Delay" },
        { value: "quality", label: "Quality Issues" },
        { value: "payment", label: "Payment Issues" },
        { value: "documentation", label: "Documentation" },
        { value: "communication", label: "Communication" },
        { value: "other", label: "Other" }
      ]
    : [
        { value: "noise", label: "Noise Complaint" },
        { value: "facility", label: "Facility Issue" },
        { value: "maintenance", label: "Maintenance" },
        { value: "security", label: "Security" },
        { value: "parking", label: "Parking" },
        { value: "other", label: "Other" }
      ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm">
        <button onClick={onBack} className="text-[#2a3e35] mb-4">
          ← Back
        </button>
        <h2 className="text-[#1E293B] mb-2">
          Complaints
        </h2>
        <p className="text-[#64748B]">
          {isPreConstruction 
            ? "Submit and track your construction-related complaints"
            : "Submit and track your complaints"
          }
        </p>
      </div>

      {/* Complaints List */}
      <div className="px-6 mt-6">
        <div className="space-y-4">
          {displayedComplaints.length > 0 ? (
            displayedComplaints.map((complaint) => (
              <Card key={complaint.id} className="p-4 bg-white rounded-2xl shadow-sm border-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-[#2a3e35]">{complaint.id}</span>
                      <Badge className={getStatusColor(complaint.status)}>
                        {complaint.status}
                      </Badge>
                    </div>
                    <h4 className="text-[#1E293B] mb-1">{complaint.subject}</h4>
                    <p className="text-sm text-[#64748B] mb-2" dir="rtl">{complaint.description}</p>
                    <p className="text-xs text-[#64748B]">{complaint.type} • {complaint.date}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#64748B] flex-shrink-0 ml-2" />
                </div>

                {/* Timeline */}
                <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                      <p className="text-xs text-[#64748B]">Submitted on {complaint.date}</p>
                    </div>
                    {complaint.status !== "Submitted" && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                        <p className="text-xs text-[#64748B]">Under review</p>
                      </div>
                    )}
                    {complaint.status === "Resolved" && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                        <p className="text-xs text-[#64748B]">Resolved</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 bg-white rounded-2xl shadow-sm border-0 text-center">
              <p className="text-[#64748B] mb-2">No complaints yet</p>
              <p className="text-sm text-[#64748B]">
                {isPreConstruction 
                  ? "Submit your first construction-related complaint"
                  : "Submit your first complaint"
                }
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* New Complaint FAB */}
      {(
        <button
          onClick={() => setShowDialog(true)}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] text-white shadow-xl flex items-center justify-center z-10 hover:scale-110 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Add Complaint Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px] bg-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#1E293B]">
              {isPreConstruction ? "Submit Construction Complaint" : "Submit New Complaint"}
            </DialogTitle>
            <DialogDescription className="text-[#64748B]">
              {isPreConstruction 
                ? "Report any issues or concerns about your unit's construction"
                : "Report any issues or concerns in your compound"
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitComplaint} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="type" className="text-[#1E293B]">Complaint Type *</Label>
              <Select value={complaintType} onValueChange={setComplaintType}>
                <SelectTrigger className="rounded-xl border-[#E2E8F0]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {complaintTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-[#1E293B]">Subject *</Label>
              <Input
                id="subject"
                value={complaintSubject}
                onChange={(e) => setComplaintSubject(e.target.value)}
                placeholder={isPreConstruction ? "e.g., Delay in construction timeline" : "e.g., Broken elevator"}
                className="rounded-xl border-[#E2E8F0]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-[#1E293B]">Description *</Label>
              <Textarea
                id="description"
                value={complaintDescription}
                onChange={(e) => setComplaintDescription(e.target.value)}
                placeholder="Provide detailed information about your complaint..."
                className="rounded-xl border-[#E2E8F0] min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority" className="text-[#1E293B]">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="rounded-xl border-[#E2E8F0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1E293B]">Attach Photos (Optional)</Label>
              <div className="border-2 border-dashed border-[#E2E8F0] rounded-xl p-6 text-center hover:border-[#2a3e35] transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                <p className="text-sm text-[#64748B]">Click to upload photos</p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                onClick={() => setShowDialog(false)}
                className="flex-1 h-11 rounded-xl bg-[#F9FAFB] text-[#1E293B] hover:bg-[#E2E8F0]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
              >
                Submit
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
