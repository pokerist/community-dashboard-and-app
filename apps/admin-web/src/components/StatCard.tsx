import { TrendingUp, TrendingDown, Minus, Users, Building2, QrCode, ClipboardList, Wallet, Shield } from "lucide-react";
import { Card } from "./ui/card";

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: string;
}

const iconMap = {
  users: Users,
  building: Building2,
  qrcode: QrCode,
  clipboard: ClipboardList,
  wallet: Wallet,
  shield: Shield,
};

export function StatCard({ title, value, change, trend, icon }: StatCardProps) {
  const IconComponent = iconMap[icon as keyof typeof iconMap] || Users;
  
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="w-4 h-4" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-[#10B981]";
    if (trend === "down") return "text-[#EF4444]";
    return "text-[#64748B]";
  };

  return (
    <Card className="p-6 shadow-card hover:shadow-hover transition-shadow duration-200 rounded-xl">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[#64748B] mb-2">{title}</p>
          <h3 className="text-[#1E293B] mb-2">{value}</h3>
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm">{change} from last month</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-[#00B386]/10 flex items-center justify-center">
          <IconComponent className="w-6 h-6 text-[#00B386]" />
        </div>
      </div>
    </Card>
  );
}
