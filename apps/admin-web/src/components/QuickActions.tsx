import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { FileText, Megaphone, Bell } from "lucide-react";

interface QuickActionsProps {
  onNavigate?: (section: string) => void;
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <Card className="p-6 shadow-card rounded-xl">
      <h3 className="mb-6 text-[#1E293B]">Quick Actions</h3>
      <div className="grid grid-cols-1 gap-3">
        <Button 
          className="w-full justify-start gap-3 bg-[#00B386] hover:bg-[#00B386]/90 text-white rounded-lg h-12"
          onClick={() => onNavigate?.("reports")}
        >
          <FileText className="w-5 h-5" />
          Generate Report
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3 border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg h-12"
          onClick={() => onNavigate?.("notifications")}
        >
          <Megaphone className="w-5 h-5" />
          Create Announcement
        </Button>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-3 border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-lg h-12"
          onClick={() => onNavigate?.("security")}
        >
          <Bell className="w-5 h-5" />
          View Alerts
        </Button>
      </div>
    </Card>
  );
}
