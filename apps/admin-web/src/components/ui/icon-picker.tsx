import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Search, X } from "lucide-react";
import * as IoIcons from "react-icons/io5";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Input } from "./input";
import { Badge } from "./badge";

const RECENT_ICONS_KEY = "community_admin_recent_service_icons_v1";

const ICON_TONES = [
  { key: "auto", label: "Auto" },
  { key: "blue", label: "Blue" },
  { key: "orange", label: "Orange" },
  { key: "purple", label: "Purple" },
  { key: "green", label: "Green" },
  { key: "pink", label: "Pink" },
  { key: "teal", label: "Teal" },
] as const;

type IconTone = (typeof ICON_TONES)[number]["key"];

type IconPickerProps = {
  value?: string | null;
  tone?: IconTone;
  onChange: (iconName: string | null) => void;
  onToneChange: (tone: IconTone) => void;
};

function toKebabCase(raw: string): string {
  return raw
    .replace(/^Io/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function readRecentIcons(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_ICONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string").slice(0, 8);
  } catch {
    return [];
  }
}

function writeRecentIcon(iconName: string) {
  if (typeof window === "undefined") return;
  const current = readRecentIcons().filter((item) => item !== iconName);
  const next = [iconName, ...current].slice(0, 8);
  window.localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(next));
}

export function IconPicker({ value, tone = "auto", onChange, onToneChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentIcons, setRecentIcons] = useState<string[]>([]);

  const iconEntries = useMemo(() => {
    return Object.entries(IoIcons)
      .filter(([name, IconComponent]) => name.startsWith("Io") && typeof IconComponent === "function")
      .map(([name, IconComponent]) => ({
        key: toKebabCase(name),
        IconComponent: IconComponent as ComponentType<{ className?: string }>,
      }))
      .filter((item) => item.key.endsWith("-outline") || item.key.endsWith("-sharp"))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, []);

  const iconMap = useMemo(() => {
    const map = new Map<string, ComponentType<{ className?: string }>>();
    for (const entry of iconEntries) {
      if (!map.has(entry.key)) map.set(entry.key, entry.IconComponent);
    }
    return map;
  }, [iconEntries]);

  const filteredIcons = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return iconEntries.slice(0, 420);
    return iconEntries.filter((entry) => entry.key.includes(normalized)).slice(0, 420);
  }, [iconEntries, query]);

  const SelectedIcon = value ? iconMap.get(value) : undefined;

  useEffect(() => {
    if (!open) return;
    setRecentIcons(readRecentIcons());
  }, [open]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex min-h-10 items-center gap-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#334155]">
          {SelectedIcon ? <SelectedIcon className="h-4 w-4" /> : <span className="text-[#94A3B8]">No icon</span>}
          <span>{value ?? "Choose an icon"}</span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline">
              Choose Icon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Choose Service Icon</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="Search icons..."
                />
              </div>
              {recentIcons.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">Recent</p>
                  <div className="flex flex-wrap gap-2">
                    {recentIcons.map((iconName) => {
                      const IconComponent = iconMap.get(iconName);
                      if (!IconComponent) return null;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => {
                            onChange(iconName);
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-2 rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#334155] hover:border-[#0F172A]/20"
                        >
                          <IconComponent className="h-4 w-4" />
                          {iconName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="max-h-[420px] overflow-y-auto rounded-lg border border-[#E2E8F0] p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {filteredIcons.map(({ key, IconComponent }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        onChange(key);
                        writeRecentIcon(key);
                        setOpen(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-md border border-[#E2E8F0] bg-white px-2 py-2 text-left text-xs text-[#334155] hover:border-[#0F172A]/20"
                    >
                      <IconComponent className="h-4 w-4 shrink-0" />
                      <span className="truncate">{key}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button type="button" variant="ghost" onClick={() => onChange(null)} className="text-[#64748B]">
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ICON_TONES.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onToneChange(option.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              tone === option.key
                ? "border-[#0F172A] bg-[#0F172A] text-white"
                : "border-[#E2E8F0] bg-white text-[#334155]"
            }`}
          >
            {option.label}
          </button>
        ))}
        <Badge variant="secondary" className="bg-[#F1F5F9] text-[#334155]">
          Tone controls icon bubble color in mobile cards
        </Badge>
      </div>
    </div>
  );
}
