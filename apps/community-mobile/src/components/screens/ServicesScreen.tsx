import { useState } from "react";
import { Search, Plus, Send } from "lucide-react";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { ServiceRequestDialog } from "../common/ServiceRequestDialog";
import { services } from "../../data/mockData";
import { toast } from "sonner@2.0.3";

interface ServicesScreenProps {
  user: any;
  onServiceSelect: (serviceId: string) => void;
}

export function ServicesScreen({ user, onServiceSelect }: ServicesScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServiceDetails, setCustomServiceDetails] = useState("");

  const availableServices = user.status === "Under Construction" 
    ? services.underConstruction 
    : services.delivered;

  const filteredServices = availableServices.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleServiceClick = (service: any) => {
    setSelectedService(service);
  };

  const handleCustomServiceRequest = () => {
    if (!customServiceName.trim() || !customServiceDetails.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    // Here you would normally send to backend
    toast.success("Service request submitted successfully! We'll get back to you soon.");
    
    // Reset form and close dialog
    setCustomServiceName("");
    setCustomServiceDetails("");
    setIsRequestDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm">
        <h2 className="text-[#1E293B] mb-4">Services</h2>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="pl-12 h-12 rounded-2xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>

      {/* Services Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          {filteredServices.map((service) => {
            return (
              <Card
                key={service.id}
                onClick={() => handleServiceClick(service)}
                className="p-4 bg-white rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-all active:scale-95"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2a3e35]/10 to-[#3d564a]/10 flex items-center justify-center mb-3">
                  <span className="text-2xl">{service.icon}</span>
                </div>
                <h4 className="text-[#1E293B] mb-1">{service.name}</h4>
                <p className="text-xs text-[#64748B] line-clamp-2">{service.description}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-[#1E293B] mb-2">No Services Found</h3>
          <p className="text-[#64748B] text-center">
            Try adjusting your search or filter
          </p>
        </div>
      )}

      {/* Request Custom Service Button */}
      <div className="fixed bottom-24 right-6 z-10">
        <button
          className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
          onClick={() => setIsRequestDialogOpen(true)}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Service Request Dialog */}
      <ServiceRequestDialog
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
        service={selectedService}
        user={user}
      />

      {/* Custom Service Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-md mx-4 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-[#1E293B]">Request Custom Service</DialogTitle>
            <DialogDescription className="text-[#64748B]">
              Can't find the service you need? Let us know what you're looking for.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label>Service Name</Label>
              <Input
                value={customServiceName}
                onChange={(e) => setCustomServiceName(e.target.value)}
                placeholder="e.g., Window Cleaning, AC Repair"
                className="mt-2 h-12 rounded-xl bg-[#F9FAFB] border-0"
              />
            </div>

            <div>
              <Label>What do you need?</Label>
              <Textarea
                value={customServiceDetails}
                onChange={(e) => setCustomServiceDetails(e.target.value)}
                placeholder="Describe what you need in detail..."
                className="mt-2 min-h-[120px] rounded-xl bg-[#F9FAFB] border-0 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRequestDialogOpen(false)}
                className="flex-1 h-12 rounded-xl border-[#E2E8F0]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCustomServiceRequest}
                disabled={!customServiceName.trim() || !customServiceDetails.trim()}
                className="flex-1 h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
