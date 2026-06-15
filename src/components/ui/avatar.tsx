"use client";

import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  imageUrl?: string;
  className?: string;
}

const colorPalette = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalette[Math.abs(hash) % colorPalette.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
  return name.slice(0, 2);
}

export function Avatar({ name, size = "md", imageUrl, className }: AvatarProps) {
  const sizeClasses = {
    xs: "w-5 h-5 text-2xs",
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base",
  };

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn("rounded-full object-cover", sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0",
        sizeClasses[size],
        getAvatarColor(name),
        className
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

interface AvatarGroupProps {
  names: string[];
  max?: number;
  size?: AvatarProps["size"];
}

export function AvatarGroup({ names, max = 3, size = "sm" }: AvatarGroupProps) {
  const visible = names.slice(0, max);
  const remaining = names.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((name) => (
        <div key={name} className="ring-2 ring-white rounded-full">
          <Avatar name={name} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            "ring-2 ring-white rounded-full bg-slate-400 text-white font-semibold flex items-center justify-center flex-shrink-0",
            size === "xs" && "w-5 h-5 text-2xs",
            size === "sm" && "w-6 h-6 text-xs",
            size === "md" && "w-8 h-8 text-sm",
          )}
          title={names.slice(max).join(", ")}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
