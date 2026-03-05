import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const WHITE_TEXT_TOKEN_REGEX =
  /(?:^|\s)[^\s]*text-(?:white(?:\/\d+)?|\[#(?:fff|ffffff)\]|\[white\]|\[rgb\(255(?:\s|,)*255(?:\s|,)*255\)\])(?=\s|$)/i;
const WHITE_BG_TOKEN_REGEX =
  /(?:^|\s)[^\s]*bg-(?:white(?:\/\d+)?|\[#(?:fff|ffffff)\](?:\/\d+)?|\[white\](?:\/\d+)?|\[rgb\(255(?:\s|,)*255(?:\s|,)*255\)\](?:\/\d+)?)(?=\s|$)/i;

function enforceButtonContrast(classNames: string): string {
  if (!WHITE_TEXT_TOKEN_REGEX.test(classNames) || !WHITE_BG_TOKEN_REGEX.test(classNames)) {
    return classNames;
  }
  return cn(classNames, "!text-[#0F172A]");
}

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-black/10 shadow-sm hover:bg-primary/90",
        dangerSolid:
          "border border-[#7F1D1D] bg-[#B91C1C] text-white shadow-sm hover:bg-[#991B1B] focus-visible:ring-[#B91C1C]/35",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] hover:text-[#0F172A]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-[#0F172A] underline-offset-4 hover:underline hover:text-[#0F172A]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const mergedClassName = buttonVariants({ variant, size, className });

  return (
    <Comp
      data-slot="button"
      className={enforceButtonContrast(mergedClassName)}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
