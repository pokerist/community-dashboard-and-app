import { motion } from "motion/react";
import { useState } from "react";
import { Logo } from "../common/Logo";

export function SplashScreen() {
  const [videoLoaded, setVideoLoaded] = useState(false);

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

      {/* Video Background Layer - Optional enhancement */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onCanPlay={() => setVideoLoaded(true)}
        onError={() => {
          // Silently fail - fallback image already shown
        }}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: videoLoaded ? 0 : -1, opacity: videoLoaded ? 1 : 0 }}
      >
        <source src="https://www.alkarmadevelopments.com/_nuxt/sideMenu.ChLFh-74.mp4" type="video/mp4" />
      </video>

      {/* Dark Overlay for text readability */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"
        style={{ zIndex: 1 }}
      />

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0 flex flex-col items-center justify-center p-6"
        style={{ zIndex: 10 }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6, type: "spring" }}
          className="mb-12"
        >
          <Logo size="lg" variant="light" />
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-white/80 text-base tracking-wide">
            Where Luxury Meets Innovation
          </p>
        </motion.div>

        {/* Loading Animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="flex space-x-2 mb-4">
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 bg-[#c9a961] rounded-full"
            />
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
              className="w-2 h-2 bg-[#c9a961] rounded-full"
            />
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
              className="w-2 h-2 bg-[#c9a961] rounded-full"
            />
          </div>
          <p className="text-white/60 text-sm">Loading your experience</p>
        </motion.div>

        {/* Powered By */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, duration: 0.6 }}
          className="absolute bottom-12 text-center"
        >
          <p className="text-white/40 text-xs tracking-wider mb-1">POWERED BY</p>
          <p className="text-white/60 text-sm tracking-wide">Smart Station Solutions</p>
        </motion.div>
      </motion.div>
    </div>
  );
}
