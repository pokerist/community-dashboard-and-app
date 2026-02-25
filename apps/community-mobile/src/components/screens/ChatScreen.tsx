import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send, Paperclip, Image as ImageIcon, Smile } from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { chatMessages } from "../../data/mockData";
import { toast } from "sonner@2.0.3";
import { motion, AnimatePresence } from "motion/react";

interface ChatScreenProps {
  user: any;
  onBack: () => void;
}

export function ChatScreen({ user, onBack }: ChatScreenProps) {
  const [messages, setMessages] = useState(chatMessages);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const userMsg = {
      id: `MSG-${Date.now()}`,
      sender: user.name,
      senderType: "user" as const,
      message: newMessage,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      read: true
    };

    setMessages([...messages, userMsg]);
    setNewMessage("");

    // Simulate agent typing
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      
      const agentMsg = {
        id: `MSG-${Date.now()}-response`,
        sender: "Support Agent",
        senderType: "admin" as const,
        message: "Thank you for your message. Our support team will assist you shortly.",
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        read: true
      };
      
      setMessages(prev => [...prev, agentMsg]);
      toast.success("Message sent");
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] p-6 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop" />
              <AvatarFallback>SA</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-white text-sm">Support Team</h3>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-[#10B981] rounded-full" />
                <p className="text-white/70 text-xs">Online</p>
              </div>
            </div>
          </div>

          <div className="w-6" />
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-56 scrollbar-thin">
        {/* Welcome Message */}
        <div className="text-center mb-6">
          <Card className="inline-block p-3 rounded-2xl border-0 bg-white/50">
            <p className="text-xs text-[#64748B]">
              Chat started • {new Date().toLocaleDateString()}
            </p>
          </Card>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex ${message.senderType === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex items-end space-x-2 max-w-[75%] ${
                message.senderType === "user" ? "flex-row-reverse space-x-reverse" : ""
              }`}>
                {message.senderType === "admin" && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop" />
                    <AvatarFallback>SA</AvatarFallback>
                  </Avatar>
                )}

                <div className={`space-y-1 ${message.senderType === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.senderType === "user"
                      ? "bg-[#2a3e35] text-white rounded-br-sm"
                      : "bg-white text-[#1E293B] rounded-bl-sm shadow-sm"
                  }`}>
                    <p className="text-sm">{message.message}</p>
                  </div>
                  <p className="text-xs text-[#64748B] px-2">{message.timestamp}</p>
                </div>

                {message.senderType === "user" && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex items-end space-x-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop" />
                <AvatarFallback>SA</AvatarFallback>
              </Avatar>
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      <div className="fixed bottom-36 left-0 right-0 max-w-lg mx-auto px-4 pb-2 bg-gradient-to-t from-[#F9FAFB] to-transparent pt-4 z-20">
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-thin">
          {["Need maintenance help", "Payment inquiry", "Access issue", "General question"].map((reply, index) => (
            <button
              key={index}
              onClick={() => setNewMessage(reply)}
              className="flex-shrink-0 px-4 py-2 rounded-full bg-white border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F9FAFB] hover:border-[#2a3e35] transition-colors shadow-sm"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto bg-white border-t border-[#E2E8F0] p-4 shadow-lg z-30">
        <div className="flex items-end space-x-2">
          {/* Attachment Buttons */}
          <div className="flex space-x-2">
            <button className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors">
              <Paperclip className="w-5 h-5 text-[#64748B]" />
            </button>
            <button className="w-10 h-10 rounded-full bg-[#F9FAFB] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors">
              <ImageIcon className="w-5 h-5 text-[#64748B]" />
            </button>
          </div>

          {/* Input */}
          <div className="flex-1 relative">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="h-12 rounded-2xl bg-[#F9FAFB] border-0 pr-12"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2">
              <Smile className="w-5 h-5 text-[#64748B]" />
            </button>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              newMessage.trim()
                ? "bg-[#2a3e35] hover:bg-[#1f2e27]"
                : "bg-[#E2E8F0]"
            }`}
          >
            <Send className={`w-5 h-5 ${newMessage.trim() ? "text-white" : "text-[#64748B]"}`} />
          </button>
        </div>

        {/* Helper Text */}
        <div className="mt-2 flex items-center justify-between px-1">
          <p className="text-xs text-[#64748B]">Response time: ~2 mins</p>
          <p className="text-xs text-[#64748B]">Available 24/7</p>
        </div>
      </div>
    </div>
  );
}
