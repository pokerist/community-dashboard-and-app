import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { CreditCard, Smartphone, Building2, Banknote, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner@2.0.3";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  currency?: string;
  title: string;
  description: string;
  billId?: string;
  onSuccess?: () => void;
}

type PaymentMethod = "card" | "fawry" | "wallet" | "cash";
type PaymentStatus = "input" | "processing" | "success" | "failed";

export function PaymentDialog({
  open,
  onOpenChange,
  amount,
  currency = "EGP",
  title,
  description,
  billId,
  onSuccess
}: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("input");
  
  // Card details
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  
  // Mobile wallet
  const [walletPhone, setWalletPhone] = useState("");
  
  // Fawry code
  const [fawryCode, setFawryCode] = useState("");

  const resetForm = () => {
    setPaymentMethod("card");
    setPaymentStatus("input");
    setCardNumber("");
    setCardName("");
    setExpiryDate("");
    setCvv("");
    setWalletPhone("");
    setFawryCode("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, "");
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(" ").slice(0, 19); // 16 digits + 3 spaces
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handlePayment = async () => {
    // Validation
    if (paymentMethod === "card") {
      if (!cardNumber || !cardName || !expiryDate || !cvv) {
        toast.error("Please fill in all card details");
        return;
      }
      if (cardNumber.replace(/\s/g, "").length !== 16) {
        toast.error("Invalid card number");
        return;
      }
    } else if (paymentMethod === "wallet") {
      if (!walletPhone || walletPhone.length < 11) {
        toast.error("Please enter a valid phone number");
        return;
      }
    } else if (paymentMethod === "fawry") {
      if (!fawryCode) {
        toast.error("Please enter Fawry reference code");
        return;
      }
    }

    // Simulate payment processing
    setPaymentStatus("processing");

    setTimeout(() => {
      // 90% success rate for simulation
      const isSuccess = Math.random() > 0.1;
      
      if (isSuccess) {
        setPaymentStatus("success");
        const transactionId = `TXN-${Date.now()}`;
        
        toast.success("Payment Successful!", {
          description: `Transaction ID: ${transactionId}`
        });

        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 2500);
      } else {
        setPaymentStatus("failed");
        toast.error("Payment Failed", {
          description: "Please try again or use a different payment method"
        });
        
        setTimeout(() => {
          setPaymentStatus("input");
        }, 2000);
      }
    }, 2500);
  };

  const paymentMethods = [
    {
      id: "card",
      name: "Credit/Debit Card",
      icon: CreditCard,
      description: "Visa, Mastercard, Meeza"
    },
    {
      id: "wallet",
      name: "Mobile Wallet",
      icon: Smartphone,
      description: "Vodafone Cash, Orange Money, etisalat Cash"
    },
    {
      id: "fawry",
      name: "Fawry",
      icon: Building2,
      description: "Pay at any Fawry location"
    },
    {
      id: "cash",
      name: "Cash",
      icon: Banknote,
      description: "Pay at compound office"
    }
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-white rounded-3xl p-0 overflow-hidden max-h-[90vh] gap-0">
        <AnimatePresence mode="wait">
          {paymentStatus === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col max-h-[90vh]"
            >
              <DialogHeader className="p-6 pb-4 flex-shrink-0">
                <DialogTitle className="text-[#1E293B]">{title}</DialogTitle>
                <DialogDescription className="text-[#64748B]">{description}</DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 scrollbar-thin">
                {/* Amount Display */}
                <div className="bg-gradient-to-br from-[#2a3e35] to-[#1f2e27] rounded-2xl p-6 mb-6">
                  <p className="text-white/80 text-sm mb-2">Total Amount</p>
                  <div className="flex items-baseline">
                    <span className="text-white text-4xl font-medium">{amount.toLocaleString()}</span>
                    <span className="text-[#c9a961] text-xl ml-2">{currency}</span>
                  </div>
                  {billId && (
                    <p className="text-white/60 text-sm mt-3">Bill ID: {billId}</p>
                  )}
                </div>

                {/* Payment Method Selection */}
                <div className="mb-6">
                  <Label className="text-[#1E293B] mb-3 block">Select Payment Method</Label>
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                    <div className="space-y-3">
                      {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        return (
                          <label
                            key={method.id}
                            className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              paymentMethod === method.id
                                ? "border-[#2a3e35] bg-[#2a3e35]/5"
                                : "border-[#E2E8F0] hover:border-[#2a3e35]/30"
                            }`}
                          >
                            <RadioGroupItem value={method.id} className="mr-3" />
                            <Icon className={`w-6 h-6 mr-3 ${paymentMethod === method.id ? "text-[#2a3e35]" : "text-[#64748B]"}`} />
                            <div className="flex-1">
                              <p className="text-[#1E293B] text-sm">{method.name}</p>
                              <p className="text-xs text-[#64748B]">{method.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </RadioGroup>
                </div>

                {/* Payment Details Forms */}
                {paymentMethod === "card" && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <Label htmlFor="cardNumber" className="text-[#1E293B] mb-2 block">Card Number</Label>
                      <Input
                        id="cardNumber"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="1234 5678 9012 3456"
                        className="rounded-xl border-[#E2E8F0]"
                        maxLength={19}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardName" className="text-[#1E293B] mb-2 block">Cardholder Name</Label>
                      <Input
                        id="cardName"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="AHMED HASSAN"
                        className="rounded-xl border-[#E2E8F0]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiry" className="text-[#1E293B] mb-2 block">Expiry Date</Label>
                        <Input
                          id="expiry"
                          value={expiryDate}
                          onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                          placeholder="MM/YY"
                          className="rounded-xl border-[#E2E8F0]"
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cvv" className="text-[#1E293B] mb-2 block">CVV</Label>
                        <Input
                          id="cvv"
                          type="password"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                          placeholder="123"
                          className="rounded-xl border-[#E2E8F0]"
                          maxLength={3}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === "wallet" && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <Label htmlFor="walletPhone" className="text-[#1E293B] mb-2 block">Mobile Wallet Number</Label>
                      <Input
                        id="walletPhone"
                        value={walletPhone}
                        onChange={(e) => setWalletPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                        placeholder="01XXXXXXXXX"
                        className="rounded-xl border-[#E2E8F0]"
                        maxLength={11}
                      />
                      <p className="text-xs text-[#64748B] mt-2">You will receive a confirmation code on your phone</p>
                    </div>
                  </div>
                )}

                {paymentMethod === "fawry" && (
                  <div className="space-y-4 mb-6">
                    <div className="bg-[#F9FAFB] rounded-xl p-4">
                      <p className="text-sm text-[#64748B] mb-2">Your Fawry Reference Code:</p>
                      <p className="text-2xl text-[#2a3e35] font-mono tracking-wider">
                        {Math.floor(1000000000 + Math.random() * 9000000000)}
                      </p>
                      <p className="text-xs text-[#64748B] mt-3">
                        Visit any Fawry location and use this code to complete your payment within 48 hours
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="fawryCode" className="text-[#1E293B] mb-2 block">
                        Or Enter Existing Fawry Code (if already paid)
                      </Label>
                      <Input
                        id="fawryCode"
                        value={fawryCode}
                        onChange={(e) => setFawryCode(e.target.value)}
                        placeholder="Enter Fawry code"
                        className="rounded-xl border-[#E2E8F0]"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "cash" && (
                  <div className="mb-6">
                    <div className="bg-[#F9FAFB] rounded-xl p-4">
                      <p className="text-sm text-[#64748B] mb-3">
                        Please visit the compound office during working hours:
                      </p>
                      <div className="space-y-2 text-sm">
                        <p className="text-[#1E293B]">📍 Karma Gates Compound Office</p>
                        <p className="text-[#64748B]">⏰ Sunday - Thursday: 9:00 AM - 5:00 PM</p>
                        <p className="text-[#64748B]">📞 +20 2 1234 5678</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                        <p className="text-xs text-[#64748B]">
                          Reference Number: <span className="text-[#2a3e35] font-mono">{billId || "N/A"}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-6 pt-4 border-t border-[#E2E8F0] bg-white flex-shrink-0">
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 h-12 rounded-xl bg-[#F9FAFB] text-[#1E293B] hover:bg-[#E2E8F0]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePayment}
                    className="flex-1 h-12 rounded-xl bg-[#2a3e35] hover:bg-[#1f2e27] text-white"
                  >
                    {paymentMethod === "cash" || (paymentMethod === "fawry" && !fawryCode) 
                      ? "Confirm" 
                      : `Pay ${amount.toLocaleString()} ${currency}`
                    }
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {paymentStatus === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center p-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-16 h-16 text-[#2a3e35]" />
              </motion.div>
              <h3 className="text-[#1E293B] mt-6 mb-2">Processing Payment...</h3>
              <p className="text-sm text-[#64748B] text-center">
                Please don't close this window
              </p>
            </motion.div>
          )}

          {paymentStatus === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center p-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-6"
              >
                <Check className="w-10 h-10 text-[#10B981]" />
              </motion.div>
              <h3 className="text-[#1E293B] mb-2">Payment Successful!</h3>
              <p className="text-sm text-[#64748B] text-center">
                Your payment has been processed successfully
              </p>
              <div className="mt-6 bg-[#F9FAFB] rounded-xl p-4 w-full">
                <p className="text-xs text-[#64748B]">Transaction ID</p>
                <p className="text-sm text-[#2a3e35] font-mono mt-1">TXN-{Date.now()}</p>
              </div>
            </motion.div>
          )}

          {paymentStatus === "failed" && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center p-12"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 rounded-full bg-[#EF4444]/10 flex items-center justify-center mb-6"
              >
                <X className="w-10 h-10 text-[#EF4444]" />
              </motion.div>
              <h3 className="text-[#1E293B] mb-2">Payment Failed</h3>
              <p className="text-sm text-[#64748B] text-center">
                Something went wrong. Please try again.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
