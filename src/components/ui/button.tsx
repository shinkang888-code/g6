"use client";

import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  asChild,
  loading,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  const content = asChild ? (
    children
  ) : (
    <>
      {loading && (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && leftIcon}
      {children}
      {rightIcon}
    </>
  );

  return (
    <Comp
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-md",
        "transition-all duration-150 cursor-pointer select-none",
        "focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm",
        {
          // Variants
          "bg-primary-600 text-white hover:bg-primary-700 shadow-sm": variant === "primary",
          "bg-slate-100 text-slate-700 hover:bg-slate-200": variant === "secondary",
          "bg-transparent text-slate-600 hover:bg-slate-100": variant === "ghost",
          "bg-danger-600 text-white hover:bg-danger-700 shadow-sm": variant === "danger",
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300": variant === "outline",
          "bg-success-500 text-white hover:bg-success-600 shadow-sm": variant === "success",
          // Sizes
          "text-xs px-2 py-1 h-6": size === "xs",
          "text-sm px-3 py-1.5 h-8": size === "sm",
          "text-sm px-4 py-2 h-9": size === "md",
          "text-base px-5 py-2.5 h-11": size === "lg",
        },
        className
      )}
      {...props}
    >
      {content}
    </Comp>
  );
}
