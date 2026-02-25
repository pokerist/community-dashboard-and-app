import { useState } from "react";
import { ArrowLeft, Lightbulb, Wind, Lock, Blinds, Plus, Power, Settings } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { smartHomeDevices } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";

interface SmartHomeScreenProps {
  onBack: () => void;
}

export function SmartHomeScreen({ onBack }: SmartHomeScreenProps) {
  const [devices, setDevices] = useState(smartHomeDevices);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case "Lighting": return Lightbulb;
      case "Climate": return Wind;
      case "Security": return Lock;
      case "Curtains": return Blinds;
      default: return Power;
    }
  };

  const getDeviceColor = (type: string) => {
    switch (type) {
      case "Lighting": return { bg: "bg-yellow-500/10", icon: "text-yellow-600", active: "bg-yellow-500" };
      case "Climate": return { bg: "bg-blue-500/10", icon: "text-blue-600", active: "bg-blue-500" };
      case "Security": return { bg: "bg-red-500/10", icon: "text-red-600", active: "bg-red-500" };
      case "Curtains": return { bg: "bg-purple-500/10", icon: "text-purple-600", active: "bg-purple-500" };
      default: return { bg: "bg-gray-500/10", icon: "text-gray-600", active: "bg-gray-500" };
    }
  };

  const toggleDevice = (deviceId: string) => {
    setDevices(devices.map(device => {
      if (device.id === deviceId) {
        const newStatus = device.status === "On" ? "Off" : "On";
        toast.success(`${device.name} turned ${newStatus.toLowerCase()}`);
        return { ...device, status: newStatus };
      }
      return device;
    }));
  };

  const updateDeviceValue = (deviceId: string, value: number) => {
    setDevices(devices.map(device => {
      if (device.id === deviceId) {
        return { ...device, value };
      }
      return device;
    }));
  };

  const groupedDevices = devices.reduce((acc, device) => {
    if (!acc[device.room]) {
      acc[device.room] = [];
    }
    acc[device.room].push(device);
    return acc;
  }, {} as Record<string, typeof devices>);

  const activeDevicesCount = devices.filter(d => d.status === "On" || d.status === "Open" || d.status === "Unlocked").length;

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] rounded-b-3xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-white">Smart Home</h2>
          <button className="text-white/80 hover:text-white">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
            <p className="text-white/60 text-xs mb-1">Total Devices</p>
            <p className="text-[#c9a961]">{devices.length}</p>
          </Card>
          <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
            <p className="text-white/60 text-xs mb-1">Active Now</p>
            <p className="text-white">{activeDevicesCount}</p>
          </Card>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => {
              setDevices(devices.map(d => ({ ...d, status: "On" })));
              toast.success("All lights turned on");
            }}
            className="flex flex-col items-center"
          >
            <div className="w-full aspect-square rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-2 hover:bg-yellow-500/20 transition-colors">
              <Lightbulb className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs text-[#64748B] text-center">All Lights</span>
          </button>

          <button
            onClick={() => {
              const lightDevices = devices.filter(d => d.type === "Lighting");
              setDevices(devices.map(d => 
                d.type === "Lighting" ? { ...d, status: "Off" } : d
              ));
              toast.success("All lights turned off");
            }}
            className="flex flex-col items-center"
          >
            <div className="w-full aspect-square rounded-2xl bg-gray-500/10 flex items-center justify-center mb-2 hover:bg-gray-500/20 transition-colors">
              <Power className="w-6 h-6 text-gray-600" />
            </div>
            <span className="text-xs text-[#64748B] text-center">All Off</span>
          </button>

          <button
            onClick={() => {
              const lockDevices = devices.filter(d => d.type === "Security");
              setDevices(devices.map(d => 
                d.type === "Security" ? { ...d, status: "Locked" } : d
              ));
              toast.success("All locks secured");
            }}
            className="flex flex-col items-center"
          >
            <div className="w-full aspect-square rounded-2xl bg-red-500/10 flex items-center justify-center mb-2 hover:bg-red-500/20 transition-colors">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-xs text-[#64748B] text-center">Lock All</span>
          </button>

          <button className="flex flex-col items-center">
            <div className="w-full aspect-square rounded-2xl bg-[#2a3e35]/10 flex items-center justify-center mb-2 hover:bg-[#2a3e35]/20 transition-colors">
              <Plus className="w-6 h-6 text-[#2a3e35]" />
            </div>
            <span className="text-xs text-[#64748B] text-center">Add Device</span>
          </button>
        </div>

        {/* Devices by Room */}
        {Object.entries(groupedDevices).map(([room, roomDevices], roomIndex) => (
          <div key={room}>
            <h3 className="text-[#1E293B] mb-4">{room}</h3>
            
            <div className="space-y-3">
              {roomDevices.map((device, index) => {
                const Icon = getDeviceIcon(device.type);
                const colors = getDeviceColor(device.type);
                const isActive = device.status === "On" || device.status === "Open" || device.status === "Unlocked";

                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (roomIndex * 0.1) + (index * 0.05) }}
                  >
                    <Card className="p-4 rounded-2xl border-0">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-xl ${isActive ? colors.active : colors.bg} flex items-center justify-center transition-colors`}>
                            <Icon className={`w-6 h-6 ${isActive ? "text-white" : colors.icon}`} />
                          </div>
                          <div>
                            <p className="text-[#1E293B]">{device.name}</p>
                            <p className="text-sm text-[#64748B]">{device.type}</p>
                          </div>
                        </div>

                        <Switch
                          checked={isActive}
                          onCheckedChange={() => toggleDevice(device.id)}
                        />
                      </div>

                      {/* Device Controls */}
                      {isActive && (device.type === "Lighting" || device.type === "Climate" || device.type === "Curtains") && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[#64748B]">
                              {device.type === "Lighting" ? "Brightness" : 
                               device.type === "Climate" ? "Temperature" : 
                               "Position"}
                            </span>
                            <span className="text-[#1E293B]">
                              {device.value}
                              {device.type === "Climate" ? "°C" : "%"}
                            </span>
                          </div>
                          <Slider
                            value={[device.value]}
                            onValueChange={(values) => updateDeviceValue(device.id, values[0])}
                            max={device.type === "Climate" ? 30 : 100}
                            min={device.type === "Climate" ? 16 : 0}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      )}

                      {/* Lock Status */}
                      {device.type === "Security" && (
                        <div className="flex items-center justify-between">
                          <Badge className={`${
                            device.status === "Locked" 
                              ? "bg-[#10B981] text-white" 
                              : "bg-[#EF4444] text-white"
                          } rounded-full text-xs`}>
                            {device.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleDevice(device.id)}
                            className="h-8 text-xs rounded-lg"
                          >
                            {device.status === "Locked" ? "Unlock" : "Lock"}
                          </Button>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
