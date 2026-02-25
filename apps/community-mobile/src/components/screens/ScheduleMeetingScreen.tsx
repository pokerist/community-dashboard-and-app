import { useState } from "react";
import { ArrowLeft, Calendar, Clock, User, CheckCircle2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Logo } from "../common/Logo";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

interface ScheduleMeetingScreenProps {
  onBack: () => void;
}

export function ScheduleMeetingScreen({ onBack }: ScheduleMeetingScreenProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [meetingType, setMeetingType] = useState<string | null>(null);
  const [step, setStep] = useState<"type" | "date" | "time" | "confirm">("type");
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);

  // Meeting types
  const meetingTypes = [
    {
      id: "sales-department",
      title: "Sales Department",
      duration: "30 min",
      description: "Units availability and purchase inquiries",
      icon: "💼",
    },
    {
      id: "construction-department",
      title: "Construction Department",
      duration: "30 min",
      description: "Construction progress and updates",
      icon: "🏗️",
    },
    {
      id: "delivery-department",
      title: "Delivery Department",
      duration: "30 min",
      description: "Unit handover and delivery process",
      icon: "🔑",
    },
    {
      id: "finance-department",
      title: "Finance Department",
      duration: "30 min",
      description: "Payment plans and financial matters",
      icon: "💰",
    },
    {
      id: "top-management",
      title: "Top Management",
      duration: "45 min",
      description: "Strategic discussions and executive matters",
      icon: "👔",
    },
    {
      id: "general-inquiry",
      title: "General Inquiry",
      duration: "15 min",
      description: "General questions and information",
      icon: "💬",
    },
  ];

  // Available time slots
  const timeSlots = [
    "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
    "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
    "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
    "04:00 PM", "04:30 PM",
  ];

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const isPastDate = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isSameDay = (date1: Date | null, date2: Date | null) => {
    if (!date1 || !date2) return false;
    return date1.toDateString() === date2.toDateString();
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleConfirm = () => {
    // Here you would typically send the appointment data to your backend
    console.log("Meeting scheduled:", {
      type: meetingType,
      date: selectedDate,
      time: selectedTime,
    });
    setShowConfirmationDialog(true);
  };

  const handleDialogClose = () => {
    setShowConfirmationDialog(false);
    onBack();
  };

  const selectedMeetingType = meetingTypes.find(t => t.id === meetingType);

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] px-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="mr-4">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white">Schedule Meeting</h1>
            <p className="text-white/60 text-sm mt-1">Book a meeting with management</p>
          </div>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Logo size="md" variant="white" />
        </div>

        {/* Branding */}
        <div className="text-center">
          <p className="text-white/80 text-sm">AlKarma Gates</p>
          <p className="text-[#c9a961] text-xs mt-1">Smart Living Solutions</p>
        </div>
      </div>

      <div className="px-6 mt-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${step === "type" ? "bg-[#c9a961]" : "bg-[#2a3e35]"}`} />
          <div className={`w-2 h-2 rounded-full ${step === "date" ? "bg-[#c9a961]" : step === "type" ? "bg-gray-300" : "bg-[#2a3e35]"}`} />
          <div className={`w-2 h-2 rounded-full ${step === "time" ? "bg-[#c9a961]" : ["type", "date"].includes(step) ? "bg-gray-300" : "bg-[#2a3e35]"}`} />
          <div className={`w-2 h-2 rounded-full ${step === "confirm" ? "bg-[#c9a961]" : "bg-gray-300"}`} />
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Select Meeting Type */}
          {step === "type" && (
            <motion.div
              key="type"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <h2 className="text-[#1E293B] mb-4">Select Meeting Type</h2>
              
              <div className="space-y-3 pb-24">
                {meetingTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setMeetingType(type.id);
                      setStep("date");
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      meetingType === type.id
                        ? "border-[#2a3e35] bg-[#2a3e35]/5"
                        : "border-gray-200 bg-white hover:border-[#2a3e35]/50"
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">{type.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[#1E293B]">{type.title}</p>
                          <Badge className="bg-[#c9a961]/10 text-[#c9a961] border-0">
                            {type.duration}
                          </Badge>
                        </div>
                        <p className="text-sm text-[#64748B]">{type.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Select Date */}
          {step === "date" && (
            <motion.div
              key="date"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("type")} className="text-[#2a3e35]">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-[#1E293B]">Select Date</h2>
                <div className="w-5" />
              </div>

              <Card className="p-6 rounded-2xl border-0">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={handlePreviousMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-[#2a3e35]" />
                  </button>
                  <h3 className="text-[#1E293B]">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h3>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-[#2a3e35]" />
                  </button>
                </div>

                {/* Day names */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {dayNames.map((day) => (
                    <div key={day} className="text-center text-xs text-[#64748B] py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const isDisabled = isPastDate(day);
                    const isSelected = isSameDay(day, selectedDate);

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => {
                          if (!isDisabled) {
                            setSelectedDate(day);
                            setStep("time");
                          }
                        }}
                        disabled={isDisabled}
                        className={`aspect-square rounded-xl flex items-center justify-center text-sm transition-all ${
                          isSelected
                            ? "bg-[#2a3e35] text-white"
                            : isDisabled
                            ? "text-gray-300 cursor-not-allowed"
                            : "hover:bg-[#2a3e35]/10 text-[#1E293B]"
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Select Time */}
          {step === "time" && (
            <motion.div
              key="time"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("date")} className="text-[#2a3e35]">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-[#1E293B]">Select Time</h2>
                <div className="w-5" />
              </div>

              <Card className="p-4 rounded-2xl border-0 mb-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-[#2a3e35]" />
                  <div>
                    <p className="text-[#1E293B] text-sm">
                      {selectedDate?.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-[#64748B]">{selectedMeetingType?.title}</p>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => {
                      setSelectedTime(time);
                      setStep("confirm");
                    }}
                    className={`p-3 rounded-xl text-sm transition-all ${
                      selectedTime === time
                        ? "bg-[#2a3e35] text-white"
                        : "bg-white border border-gray-200 text-[#1E293B] hover:border-[#2a3e35]"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: Confirm */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setStep("time")} className="text-[#2a3e35]">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-[#1E293B]">Confirm Meeting</h2>
                <div className="w-5" />
              </div>

              <Card className="p-6 rounded-2xl border-0 bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] mb-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-[#c9a961]" />
                  </div>
                </div>
                <h3 className="text-white text-center mb-2">Meeting Details</h3>
                <p className="text-white/60 text-sm text-center">Review your meeting information</p>
              </Card>

              <div className="space-y-4">
                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B] mb-1">Meeting Type</p>
                      <p className="text-[#1E293B]">{selectedMeetingType?.title}</p>
                      <p className="text-sm text-[#64748B] mt-1">{selectedMeetingType?.duration}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B] mb-1">Date</p>
                      <p className="text-[#1E293B]">
                        {selectedDate?.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 rounded-2xl border-0">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B] mb-1">Time</p>
                      <p className="text-[#1E293B]">{selectedTime}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Button
                onClick={handleConfirm}
                className="w-full h-14 mt-6 mb-24 rounded-2xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
              >
                Confirm Meeting
              </Button>

              <p className="text-xs text-center text-[#64748B] mt-4">
                You will receive a confirmation email with meeting details
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
        <AlertDialogContent className="max-w-[90%] rounded-3xl">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-[#F59E0B]/10 flex items-center justify-center">
                <Clock className="w-8 h-8 text-[#F59E0B]" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-[#1E293B]">
              Meeting Request Submitted
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <div className="space-y-3 mt-4">
                <p className="text-[#64748B]">
                  Your meeting request has been submitted successfully and is now awaiting admin confirmation.
                </p>
                
                <Card className="p-4 rounded-2xl border-0 bg-[#c9a961]/5">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-[#c9a961] flex-shrink-0 mt-0.5" />
                    <div className="text-left">
                      <p className="text-sm text-[#1E293B]">
                        You will receive a notification once the admin reviews and confirms your meeting request.
                      </p>
                    </div>
                  </div>
                </Card>

                <div className="bg-[#F9FAFB] rounded-xl p-3 text-left">
                  <p className="text-xs text-[#64748B] mb-2">Meeting Details:</p>
                  <div className="space-y-1">
                    <p className="text-sm text-[#1E293B]">
                      {selectedMeetingType?.icon} {selectedMeetingType?.title}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      📅 {selectedDate?.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })} at {selectedTime}
                    </p>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleDialogClose}
              className="w-full h-12 rounded-2xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
            >
              Got it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
