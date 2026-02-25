import logoImage from "figma:asset/0c7a0cd1f45864e0108618f40b9f2a75ac95e9dc.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark" | "color" | "horizontal";
  className?: string;
}

export function Logo({ size = "md", variant = "light", className = "" }: LogoProps) {
  const sizes = {
    sm: { width: "w-24" },
    md: { width: "w-32" },
    lg: { width: "w-40" }
  };

  const currentSize = sizes[size];

  // Filter for logo color variants
  const getFilter = () => {
    switch (variant) {
      case "light":
      case "horizontal":
        return "brightness(0) invert(1)"; // White
      case "dark":
        return "brightness(0)"; // Black
      case "color":
        return "none"; // Original colors
      default:
        return "brightness(0) invert(1)"; // Default to white
    }
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img 
        src={logoImage} 
        alt="Al Karma Developments" 
        className={`${currentSize.width} h-auto`}
        style={{ filter: getFilter() }}
      />
    </div>
  );
}
