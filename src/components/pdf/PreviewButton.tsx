"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { CaseFile } from "@/lib/caseScopedStorage";
import { openCaseFilePreview } from "@/lib/pdfPreview";
import { cn } from "@/lib/utils";

type Props = {
  file: CaseFile | { fileName: string; mimeType?: string; url?: string; driveFileId?: string; id?: string };
  caseId?: string;
  /** inline 패널용 — 새 창 대신 콜백 */
  onPreview?: () => void;
  size?: "sm" | "md";
  variant?: "outline" | "ghost" | "primary";
  showLabel?: boolean;
  className?: string;
};

export function PreviewButton({
  file,
  caseId,
  onPreview,
  size = "sm",
  variant = "outline",
  showLabel = true,
  className,
}: Props) {
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPreview) {
      onPreview();
      return;
    }
    try {
      await openCaseFilePreview(file as CaseFile, { caseId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "미리보기를 열 수 없습니다.");
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("shrink-0", className)}
      leftIcon={<Eye size={size === "sm" ? 13 : 14} />}
      onClick={(e) => void handleClick(e)}
      title="미리보기"
    >
      {showLabel ? "미리보기" : null}
    </Button>
  );
}
