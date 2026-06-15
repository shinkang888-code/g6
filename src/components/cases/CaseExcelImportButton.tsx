"use client";

import { useRef } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Props = {
  onFileSelect: (file: File) => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "outline" | "secondary" | "primary";
  className?: string;
  label?: string;
  fullWidth?: boolean;
};

export function CaseExcelImportButton({
  onFileSelect,
  loading = false,
  disabled = false,
  size = "xs",
  variant = "outline",
  className,
  label = "엑셀등록",
  fullWidth = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) {
      toast.error("엑셀 파일(.xlsx, .xls, .csv)만 업로드할 수 있습니다.");
      return;
    }
    await onFileSelect(file);
  };

  return (
    <label className={cn("inline-flex cursor-pointer", fullWidth && "w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleChange}
        disabled={disabled || loading}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(fullWidth && "w-full")}
        leftIcon={
          loading ? (
            <Loader2 size={size === "xs" ? 12 : 14} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={size === "xs" ? 12 : 14} />
          )
        }
        disabled={disabled || loading}
        asChild
      >
        <span>{loading ? "분석 중…" : label}</span>
      </Button>
    </label>
  );
}
