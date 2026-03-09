import { useState, useMemo } from "react";
import {
  Shield, Wrench, Flame, Trophy, Sparkles, Laptop,
  Zap, Heart, Star, Home, Key, Lock, Bell,
  Clipboard, FileText, Calendar, Clock, Truck,
  Wifi, Droplet, Sun, Thermometer, PaintBucket,
  Hammer, Phone, Mail, Camera, Music, MapPin,
  Building, Car, Users, AlertTriangle, Leaf,
  Waves, Dumbbell, Baby, PartyPopper, Tent,
  Bike, Gamepad2, Theater, Volleyball, Palette,
  BookOpen, Coffee, Dog, Flower2, Trees,
  type LucideIcon,
} from "lucide-react";

/** Master map – add new icons here to make them selectable everywhere. */
export const ICON_MAP: Record<string, LucideIcon> = {
  shield: Shield, wrench: Wrench, flame: Flame, trophy: Trophy,
  sparkles: Sparkles, laptop: Laptop, zap: Zap, heart: Heart,
  star: Star, home: Home, key: Key, lock: Lock, bell: Bell,
  clipboard: Clipboard, "file-text": FileText, calendar: Calendar,
  clock: Clock, truck: Truck, wifi: Wifi, droplet: Droplet,
  sun: Sun, thermometer: Thermometer, "paint-bucket": PaintBucket,
  hammer: Hammer, phone: Phone, mail: Mail, camera: Camera,
  music: Music, "map-pin": MapPin, building: Building, car: Car,
  users: Users, "alert-triangle": AlertTriangle, leaf: Leaf,
  waves: Waves, dumbbell: Dumbbell, baby: Baby,
  "party-popper": PartyPopper, tent: Tent, bike: Bike,
  gamepad2: Gamepad2, theater: Theater, volleyball: Volleyball,
  palette: Palette, "book-open": BookOpen, coffee: Coffee,
  dog: Dog, flower2: Flower2, trees: Trees,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

/** Resolve an icon component by name (case-insensitive, handles PascalCase & kebab-case). */
export function resolveIcon(name: string): LucideIcon | undefined {
  const lower = name.toLowerCase().replace(/\s+/g, "-");
  if (ICON_MAP[lower]) return ICON_MAP[lower];
  // Try converting PascalCase → kebab-case
  const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  return ICON_MAP[kebab];
}

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
  color?: string;               // Active accent color (hex)
  allowEmpty?: boolean;
}

export function IconPicker({ value, onChange, color = "#6B7280", allowEmpty = false }: IconPickerProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return ICON_NAMES;
    const q = search.toLowerCase();
    return ICON_NAMES.filter((n) => n.includes(q));
  }, [search]);

  const selectedIcon = value ? resolveIcon(value) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontFamily: "'Work Sans', sans-serif" }}>
      {/* Search bar */}
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search icons…"
          style={{
            width: "100%", padding: "7px 10px", fontSize: "12px",
            border: "1px solid #E5E7EB", borderRadius: "7px",
            outline: "none", fontFamily: "'Work Sans', sans-serif",
            boxSizing: "border-box",
          }}
        />
        {value && selectedIcon && (
          <div style={{
            position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
            display: "flex", alignItems: "center", gap: "4px",
            padding: "2px 6px", borderRadius: "5px",
            background: color + "18", border: `1px solid ${color}44`,
          }}>
            {(() => { const IC = selectedIcon; return <IC style={{ width: "12px", height: "12px", color }} />; })()}
            <span style={{ fontSize: "10px", color, fontWeight: 600 }}>{value}</span>
          </div>
        )}
      </div>

      {/* Icon grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
        gap: "4px", maxHeight: "160px", overflowY: "auto",
        padding: "4px", border: "1px solid #F3F4F6", borderRadius: "7px", background: "#FAFAFA",
      }}>
        {allowEmpty && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="None"
            style={{
              width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "6px", cursor: "pointer",
              border: !value ? `2px solid ${color}` : "1px solid #E5E7EB",
              background: !value ? color + "14" : "#FFF",
              transition: "all 100ms",
            }}
          >
            <span style={{ fontSize: "10px", color: "#9CA3AF" }}>—</span>
          </button>
        )}
        {filtered.map((name) => {
          const IC = ICON_MAP[name];
          const selected = value.toLowerCase().replace(/\s+/g, "-") === name ||
            value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase() === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              title={name}
              style={{
                width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "6px", cursor: "pointer",
                border: selected ? `2px solid ${color}` : "1px solid #E5E7EB",
                background: selected ? color + "14" : "#FFF",
                transition: "all 100ms",
              }}
            >
              <IC style={{ width: "16px", height: "16px", color: selected ? color : "#6B7280" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
