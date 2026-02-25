import { useState } from "react";
import { Card } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Bell, CreditCard, Wrench, Shield, Calendar, ChevronRight } from "lucide-react";
import { notifications } from "../../data/mockData";

export function NotificationsScreen() {
  const [filter, setFilter] = useState("all");

  const getIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <CreditCard className="w-5 h-5 text-[#F59E0B]" />;
      case "service":
        return <Wrench className="w-5 h-5 text-[#2a3e35]" />;
      case "security":
        return <Shield className="w-5 h-5 text-[#EF4444]" />;
      case "event":
        return <Calendar className="w-5 h-5 text-[#10B981]" />;
      default:
        return <Bell className="w-5 h-5 text-[#64748B]" />;
    }
  };

  const filteredNotifications = filter === "all" 
    ? notifications 
    : notifications.filter(n => !n.read);

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-white p-6 shadow-sm">
        <h2 className="text-[#1E293B] mb-2">Notifications</h2>
        <p className="text-[#64748B]">Stay updated with latest news</p>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full transition-colors ${
              filter === "all"
                ? "bg-[#2a3e35] text-white"
                : "bg-white text-[#64748B]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded-full transition-colors ${
              filter === "unread"
                ? "bg-[#2a3e35] text-white"
                : "bg-white text-[#64748B]"
            }`}
          >
            Unread ({notifications.filter(n => !n.read).length})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-6 space-y-3">
        {filteredNotifications.map((notification) => (
          <Card
            key={notification.id}
            className={`p-4 rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow ${
              notification.read ? "bg-white" : "bg-[#2a3e35]/5"
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                notification.read ? "bg-[#F9FAFB]" : "bg-white"
              }`}>
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="text-[#1E293B]">{notification.title}</h4>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-[#2a3e35] rounded-full flex-shrink-0 ml-2 mt-1" />
                  )}
                </div>
                <p className="text-sm text-[#64748B] mb-2">{notification.message}</p>
                <p className="text-xs text-[#64748B]">{notification.timestamp}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredNotifications.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-[#1E293B] mb-2">No Notifications</h3>
          <p className="text-[#64748B] text-center">
            You're all caught up!
          </p>
        </div>
      )}

      {/* Mark All as Read Button */}
      {filteredNotifications.some(n => !n.read) && (
        <div className="px-6 mt-6">
          <button className="w-full h-12 rounded-xl bg-white text-[#2a3e35] border-2 border-[#2a3e35] hover:bg-[#2a3e35]/5 transition-colors">
            Mark All as Read
          </button>
        </div>
      )}
    </div>
  );
}
