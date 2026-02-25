import { useState } from "react";
import { Button } from "../ui/button";
import { ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Logo } from "../common/Logo";

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({
  onComplete,
}: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Welcome to Al Karma",
      subtitle: "Smart Living",
      description:
        "Experience luxury living with cutting-edge smart home technology and world-class amenities across our premium developments.",
      image:
        "https://images.unsplash.com/photo-1560613654-ea1945efc370?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aWxsYSUyMGNvbXBvdW5kJTIwZWd5cHR8ZW58MXx8fHwxNzYwMzYyMzQ1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    },
    {
      title: "Your Compounds",
      subtitle: "Karma • Karma Gates • Kay",
      description:
        "Access all your properties in one place. Manage services, payments, and security for all your Al Karma developments seamlessly.",
      image:
        "https://images.unsplash.com/photo-1643892605308-70a6559cfd0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjByZXNpZGVudGlhbCUyMGNvbXBvdW5kJTIwYWVyaWFsfGVufDF8fHx8MTc2MDM2MjM0NXww&ixlib=rb-4.1.0&q=80&w=1080",
    },
    {
      title: "Smart & Secure",
      subtitle: "Your Safety, Our Priority",
      description:
        "Generate QR codes for visitors, track deliveries, manage complaints, and stay connected with our 24/7 smart security system.",
      image:
        "https://images.unsplash.com/photo-1633194883650-df448a10d554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFydCUyMGhvbWUlMjBzZWN1cml0eSUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzYwMzYyMzQ1fDA&ixlib=rb-4.1.0&q=80&w=1080",
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="h-screen w-full relative overflow-hidden bg-[#1a1a1a]">
      {/* Fallback Image Background - Always shown */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        <img
          src="https://images.unsplash.com/photo-1622015663381-d2e05ae91b72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtb2Rlcm4lMjB2aWxsYSUyMGFyY2hpdGVjdHVyZXxlbnwxfHx8fDE3NjAzNDMxNzJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Al Karma Development"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Video Background - Optional enhancement */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={() => {
          // Silently fail - fallback image already shown
        }}
        className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-1000"
        style={{ zIndex: 0 }}
        onCanPlay={(e) => {
          (e.target as HTMLVideoElement).style.opacity = '1';
        }}
      >
        <source
          src="https://www.alkarmadevelopments.com/_nuxt/sideMenu.ChLFh-74.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark Overlay for text readability */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"
        style={{ zIndex: 1 }}
      />

      {/* Skip Button */}
      <div className="flex justify-end p-6 relative z-10">
        <button
          onClick={handleSkip}
          className="text-white/70 hover:text-white transition-colors text-sm tracking-wide"
        >
          SKIP
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between pb-12 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="mb-8"
            >
              <Logo variant="horizontal" size="md" />
            </motion.div>

            {/* Image */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-64 h-64 mb-12 rounded-3xl overflow-hidden shadow-2xl"
            >
              <img
                src={slides[currentSlide].image}
                alt={slides[currentSlide].title}
                className="w-full h-full object-cover"
              />
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-white mb-2 tracking-wide"
              style={{ fontWeight: "400" }}
            >
              {slides[currentSlide].title}
            </motion.h2>

            {/* Subtitle with gold accent */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="h-px bg-gradient-to-r from-transparent via-[#c9a961] to-transparent w-32 mb-3"
            />

            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-[#c9a961] mb-6 text-sm tracking-widest uppercase"
              style={{ fontWeight: "300" }}
            >
              {slides[currentSlide].subtitle}
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-white/80 text-base leading-relaxed max-w-sm"
            >
              {slides[currentSlide].description}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* Bottom Section */}
        <div className="px-8">
          {/* Pagination Dots */}
          <div className="flex justify-center space-x-2 mt-10 mb-6">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`transition-all ${
                  index === currentSlide
                    ? "w-8 h-2 bg-[#c9a961]"
                    : "w-2 h-2 bg-white/30 hover:bg-white/50"
                } rounded-full`}
              />
            ))}
          </div>

          {/* Next Button */}
          <Button
            onClick={handleNext}
            className="w-full bg-white text-[#2a3e35] hover:bg-white/90 h-14 rounded-2xl shadow-xl group"
          >
            <span className="tracking-wide">
              {currentSlide === slides.length - 1
                ? "GET STARTED"
                : "NEXT"}
            </span>
            <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Decorative Background Elements */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 2 }}
      >
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#c9a961]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
}