"use client";

import { useTheme } from "next-themes@0.4.6";
import { Toaster as Sonner, ToasterProps } from "sonner@2.0.3";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          title: "!text-[#0F172A] !font-semibold",
          description: "!text-[#334155]",
          toast:
            "border border-[#CBD5E1] bg-white text-[#0F172A] shadow-lg",
          success:
            "border border-[#BBF7D0] bg-[#F0FDF4] text-[#14532D]",
          error:
            "border border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]",
          warning:
            "border border-[#FDE68A] bg-[#FFFBEB] text-[#78350F]",
          info:
            "border border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]",
        },
      }}
      style={
        {
          "--normal-bg": "#FFFFFF",
          "--normal-text": "#0F172A",
          "--normal-border": "#CBD5E1",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
