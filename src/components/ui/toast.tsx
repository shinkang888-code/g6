"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset="5.5rem"
      mobileOffset={{ bottom: "5.5rem" }}
      toastOptions={{
        classNames: {
          toast: "font-sans text-sm shadow-lg rounded-xl border",
          success: "bg-white border-success-200 text-text-primary",
          error: "bg-white border-danger-200 text-text-primary",
          warning: "bg-white border-warning-200 text-text-primary",
          info: "bg-white border-primary-200 text-text-primary",
          title: "font-semibold",
          description: "text-text-muted text-xs",
        },
      }}
    />
  );
}

export { toast } from "sonner";
