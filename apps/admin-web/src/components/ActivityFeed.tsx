import { Card } from "./ui/card";
import { Wrench, Key, CreditCard, Calendar, ShieldAlert, Dumbbell } from "lucide-react";

interface Activity {
  id: number;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  type: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const activityIcons = {
  maintenance: Wrench,
  access: Key,
  payment: CreditCard,
  booking: Calendar,
  security: ShieldAlert,
  amenity: Dumbbell,
};

const activityColors = {
  maintenance: "bg-[#0B5FFF]/10 text-[#0B5FFF]",
  access: "bg-[#00B386]/10 text-[#00B386]",
  payment: "bg-[#10B981]/10 text-[#10B981]",
  booking: "bg-[#3B82F6]/10 text-[#3B82F6]",
  security: "bg-[#EF4444]/10 text-[#EF4444]",
  amenity: "bg-[#F59E0B]/10 text-[#F59E0B]",
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="p-6 shadow-card rounded-xl">
      <h3 className="mb-6 text-[#1E293B]">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.type as keyof typeof activityIcons] || Wrench;
          const colorClass = activityColors[activity.type as keyof typeof activityColors];
          
          return (
            <div key={activity.id} className="flex gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#1E293B]">
                  <span className="font-medium">{activity.user}</span>{" "}
                  <span className="text-[#64748B]">{activity.action}</span>{" "}
                  <span className="font-medium">{activity.target}</span>
                </p>
                <p className="text-xs text-[#64748B] mt-1">{activity.timestamp}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
