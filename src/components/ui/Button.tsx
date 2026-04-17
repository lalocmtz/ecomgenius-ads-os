"use client";
import { cn } from "@/lib/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded font-medium transition focus:outline-none focus:ring-2 focus:ring-verdict-winner/60 disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-verdict-winner text-bg hover:bg-verdict-winner/90",
        secondary: "bg-bg-raised border border-border text-text-primary hover:bg-bg-hover",
        danger: "bg-verdict-loser text-white hover:bg-verdict-loser/90",
        ghost: "text-text-primary hover:bg-bg-hover",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
