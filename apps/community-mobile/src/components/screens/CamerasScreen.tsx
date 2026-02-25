import { useState } from "react";
import { ArrowLeft, Camera, Video, Maximize2, RotateCw, Moon, Bell, Settings, Eye } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { securityCameras } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion } from "motion/react";

interface CamerasScreenProps {
  onBack: () => void;
}

export function CamerasScreen({ onBack }: CamerasScreenProps) {
  const [cameras, setCameras] = useState(securityCameras);
  const [selectedCamera, setSelectedCamera] = useState<any>(null);
  const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);

  const getCameraTypeColor = (type: string) => {
    switch (type) {
      case "Fixed": return { bg: "bg-blue-500/10", text: "text-blue-600" };
      case "Doorbell": return { bg: "bg-green-500/10", text: "text-green-600" };
      case "PTZ": return { bg: "bg-purple-500/10", text: "text-purple-600" };
      default: return { bg: "bg-gray-500/10", text: "text-gray-600" };
    }
  };

  const handleViewLive = (camera: any) => {
    setSelectedCamera(camera);
    setIsLiveViewOpen(true);
    toast.success(`Opening live feed for ${camera.name}`);
  };

  const toggleMotionDetection = (cameraId: string) => {
    setCameras(cameras.map(cam => {
      if (cam.id === cameraId) {
        const newStatus = !cam.hasMotionDetection;
        toast.success(`Motion detection ${newStatus ? "enabled" : "disabled"}`);
        return { ...cam, hasMotionDetection: newStatus };
      }
      return cam;
    }));
  };

  const activeCamerasCount = cameras.filter(c => c.status === "Active").length;
  const motionEnabledCount = cameras.filter(c => c.hasMotionDetection).length;

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] rounded-b-3xl p-6 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-white">Security Cameras</h2>
          <button className="text-white/80 hover:text-white">
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
            <p className="text-white/60 text-xs mb-1">Total</p>
            <p className="text-[#c9a961]">{cameras.length}</p>
          </Card>
          <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
            <p className="text-white/60 text-xs mb-1">Active</p>
            <p className="text-white">{activeCamerasCount}</p>
          </Card>
          <Card className="p-3 bg-white/10 backdrop-blur-sm border-0 rounded-xl">
            <p className="text-white/60 text-xs mb-1">Motion</p>
            <p className="text-white">{motionEnabledCount}</p>
          </Card>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 space-y-4">
        {cameras.map((camera, index) => {
          const typeColors = getCameraTypeColor(camera.type);
          
          return (
            <motion.div
              key={camera.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="rounded-2xl border-0 overflow-hidden">
                {/* Camera Thumbnail */}
                <div className="relative h-48 bg-gray-900">
                  <img
                    src={camera.thumbnail}
                    alt={camera.name}
                    className="w-full h-full object-cover opacity-80"
                  />
                  
                  {/* Live Badge */}
                  {camera.isLive && (
                    <Badge className="absolute top-3 left-3 bg-red-500 text-white rounded-full text-xs animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full mr-1 inline-block" />
                      LIVE
                    </Badge>
                  )}

                  {/* Camera Type */}
                  <Badge className={`absolute top-3 right-3 ${typeColors.bg} ${typeColors.text} rounded-full text-xs`}>
                    {camera.type}
                  </Badge>

                  {/* Overlay Icons */}
                  <div className="absolute bottom-3 left-3 flex items-center space-x-2">
                    {camera.hasMotionDetection && (
                      <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <Bell className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {camera.hasNightVision && (
                      <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                        <Moon className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* View Live Button Overlay */}
                  <button
                    onClick={() => handleViewLive(camera)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                  </button>
                </div>

                {/* Camera Info */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-[#1E293B] mb-1">{camera.name}</h4>
                      <p className="text-sm text-[#64748B]">{camera.location}</p>
                    </div>
                    <Badge className={`${
                      camera.status === "Active" 
                        ? "bg-[#10B981] text-white" 
                        : "bg-[#64748B] text-white"
                    } rounded-full text-xs`}>
                      {camera.status}
                    </Badge>
                  </div>

                  {/* Features */}
                  <div className="flex items-center space-x-4 text-xs text-[#64748B]">
                    <div className="flex items-center space-x-1">
                      <Bell className="w-3 h-3" />
                      <span>Motion Detection</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Moon className="w-3 h-3" />
                      <span>Night Vision</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    {camera.canControl ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-[#64748B]">Motion Alerts</span>
                        <Switch
                          checked={camera.hasMotionDetection}
                          onCheckedChange={() => toggleMotionDetection(camera.id)}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-[#64748B]">
                        Managed by {camera.addedBy}
                      </span>
                    )}

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleViewLive(camera)}
                        className="h-9 rounded-lg bg-[#2a3e35] hover:bg-[#1f2e27]"
                      >
                        <Video className="w-3 h-3 mr-1" />
                        View Live
                      </Button>
                      
                      {camera.canControl && camera.type === "PTZ" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-lg"
                        >
                          <RotateCw className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}

        {/* Add Camera Card */}
        <Card className="p-8 text-center rounded-2xl border-2 border-dashed border-[#E2E8F0] hover:border-[#2a3e35] hover:bg-[#F9FAFB] transition-all cursor-pointer">
          <div className="w-16 h-16 rounded-full bg-[#2a3e35]/10 flex items-center justify-center mx-auto mb-3">
            <Camera className="w-8 h-8 text-[#2a3e35]" />
          </div>
          <p className="text-[#1E293B] mb-1">Add New Camera</p>
          <p className="text-sm text-[#64748B]">Connect a new security camera</p>
        </Card>
      </div>

      {/* Live View Dialog */}
      <Dialog open={isLiveViewOpen} onOpenChange={setIsLiveViewOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Live Camera Feed</DialogTitle>
            <DialogDescription>View live camera feed and controls</DialogDescription>
          </DialogHeader>
          <div className="relative">
            {/* Live Feed */}
            <div className="relative h-96 bg-gray-900">
              {selectedCamera && (
                <>
                  <img
                    src={selectedCamera.thumbnail}
                    alt={selectedCamera.name}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Live Overlay */}
                  <Badge className="absolute top-4 left-4 bg-red-500 text-white rounded-full text-xs animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full mr-1 inline-block" />
                    LIVE
                  </Badge>

                  {/* Fullscreen Button */}
                  <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors">
                    <Maximize2 className="w-5 h-5 text-white" />
                  </button>

                  {/* Camera Name */}
                  <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded-xl p-3">
                    <p className="text-white mb-1">{selectedCamera.name}</p>
                    <p className="text-sm text-white/80">{selectedCamera.location}</p>
                  </div>
                </>
              )}
            </div>

            {/* Controls */}
            {selectedCamera?.canControl && selectedCamera?.type === "PTZ" && (
              <div className="p-4 bg-white">
                <p className="text-sm text-[#64748B] mb-3">Camera Controls</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg">↑</Button>
                  <Button variant="outline" size="sm" className="rounded-lg">↓</Button>
                  <Button variant="outline" size="sm" className="rounded-lg">←</Button>
                  <Button variant="outline" size="sm" className="rounded-lg">→</Button>
                  <Button variant="outline" size="sm" className="rounded-lg">🔍+</Button>
                  <Button variant="outline" size="sm" className="rounded-lg">🔍-</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
