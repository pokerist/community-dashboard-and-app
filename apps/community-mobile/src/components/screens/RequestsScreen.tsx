import { useState } from "react";
import { ArrowLeft, Search, FileText, Truck, Calendar, Shield, Wifi, Car, Zap, Droplet, Flame, Home as HomeIcon, Building, MoreHorizontal } from "lucide-react";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { RequestFormDialog } from "../common/RequestFormDialog";

interface RequestsScreenProps {
  onBack: () => void;
  user: any;
}

export function RequestsScreen({ onBack, user }: RequestsScreenProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const requestTypes = [
    {
      id: "permits",
      icon: Shield,
      name: "Permits",
      description: "Request access permits",
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      id: "truck",
      icon: Truck,
      name: "Truck",
      description: "Request truck access",
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-600",
    },
    {
      id: "event",
      icon: Calendar,
      name: "Event",
      description: "Request event permits",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
    {
      id: "insurance",
      icon: Shield,
      name: "Insurance Check Refund",
      description: "Request insurance refund",
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-500/10",
      iconColor: "text-green-600",
    },
    {
      id: "triple-play",
      icon: Wifi,
      name: "Triple Play",
      description: "Internet, TV & Phone bundle",
      color: "from-cyan-500 to-cyan-600",
      bgColor: "bg-cyan-500/10",
      iconColor: "text-cyan-600",
    },
    {
      id: "car-sticker",
      icon: Car,
      name: "Car Sticker",
      description: "Request vehicle sticker",
      color: "from-pink-500 to-pink-600",
      bgColor: "bg-pink-500/10",
      iconColor: "text-pink-600",
    },
    {
      id: "electricity",
      icon: Zap,
      name: "Electricity",
      description: "Electricity utility requests",
      color: "from-yellow-500 to-yellow-600",
      bgColor: "bg-yellow-500/10",
      iconColor: "text-yellow-600",
    },
    {
      id: "water",
      icon: Droplet,
      name: "Water",
      description: "Water utility requests",
      color: "from-blue-400 to-blue-500",
      bgColor: "bg-blue-400/10",
      iconColor: "text-blue-500",
    },
    {
      id: "gas",
      icon: Flame,
      name: "Gas",
      description: "Gas utility requests",
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-500/10",
      iconColor: "text-red-600",
    },
    {
      id: "design-modifications",
      icon: HomeIcon,
      name: "Design Modifications",
      description: "Request unit modifications",
      color: "from-indigo-500 to-indigo-600",
      bgColor: "bg-indigo-500/10",
      iconColor: "text-indigo-600",
    },
    {
      id: "rental",
      icon: Building,
      name: "Rental",
      description: "Rental related requests",
      color: "from-teal-500 to-teal-600",
      bgColor: "bg-teal-500/10",
      iconColor: "text-teal-600",
    },
    {
      id: "others",
      icon: MoreHorizontal,
      name: "Others",
      description: "Other requests",
      color: "from-gray-500 to-gray-600",
      bgColor: "bg-gray-500/10",
      iconColor: "text-gray-600",
    },
  ];

  const filteredRequests = requestTypes.filter(request =>
    request.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRequestClick = (request: any) => {
    setSelectedRequest(request);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#1E293B]" />
          </button>
          <div>
            <h2 className="text-[#1E293B]">Requests</h2>
            <p className="text-sm text-[#64748B]">Submit your requests</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search requests..."
            className="pl-12 h-12 rounded-2xl bg-[#F9FAFB] border-0"
          />
        </div>
      </div>

      {/* Requests Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4">
          {filteredRequests.map((request) => {
            const Icon = request.icon;
            return (
              <Card
                key={request.id}
                onClick={() => handleRequestClick(request)}
                className="p-4 bg-white rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-all active:scale-95"
              >
                <div className={`w-12 h-12 rounded-xl ${request.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={`w-6 h-6 ${request.iconColor}`} />
                </div>
                <h4 className="text-[#1E293B] mb-1">{request.name}</h4>
                <p className="text-xs text-[#64748B] line-clamp-2">{request.description}</p>
              </Card>
            );
          })}
        </div>

        {/* Request Form Dialog */}
        <RequestFormDialog
          isOpen={!!selectedRequest}
          onClose={() => setSelectedRequest(null)}
          requestType={selectedRequest}
          user={user}
        />

        {/* Empty State */}
        {filteredRequests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-[#1E293B] mb-2">No Requests Found</h3>
            <p className="text-[#64748B] text-center">
              Try adjusting your search
            </p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="px-6 pb-6">
        <Card className="p-4 bg-gradient-to-br from-[#2a3e35]/5 to-[#2a3e35]/10 border-0">
          <div className="flex items-start space-x-3">
            <FileText className="w-5 h-5 text-[#2a3e35] mt-0.5" />
            <div>
              <h4 className="text-[#1E293B] mb-1">Need help?</h4>
              <p className="text-sm text-[#64748B]">
                Contact management for assistance with your requests
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
