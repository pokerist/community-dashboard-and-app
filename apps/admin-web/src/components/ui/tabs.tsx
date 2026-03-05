"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs@1.1.3";

import { cn } from "./utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-[#F8FAFC] text-[#334155] inline-flex h-10 w-fit items-center justify-center rounded-xl border border-[#E2E8F0] p-[3px] flex",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-xl border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap text-[#64748B] transition-[color,box-shadow,background-color,border-color,transform] duration-150 hover:text-[#334155] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[state=active]:bg-white data-[state=active]:text-[#0F172A] data-[state=active]:border-[#94A3B8] data-[state=active]:shadow-[0_1px_0_rgba(15,23,42,0.06),0_4px_10px_rgba(15,23,42,0.08)] data-[state=active]:ring-2 data-[state=active]:ring-[#0B5FFF]/15 data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:left-2 data-[state=active]:after:right-2 data-[state=active]:after:bottom-[2px] data-[state=active]:after:h-[3px] data-[state=active]:after:rounded-full data-[state=active]:after:bg-[#0B5FFF] data-[state=active]:after:shadow-[0_0_0_1px_rgba(11,95,255,0.08)] aria-[selected=true]:font-semibold aria-[selected=true]:text-[#0F172A]",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
