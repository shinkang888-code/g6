"use client";

import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type ButtonSize = "xs" | "sm" | "md";

type Props = {
  count?: number;
  loading?: boolean;
  disabled?: boolean;
  size?: ButtonSize;
  onExport: () => void | Promise<void>;
  emptyMessage?: string;
  /** 기본: 검색결과 엑셀 */
  label?: string;
  title?: string;
};

export function SearchResultExcelButton({
  count,
  loading,
  disabled,
  size = "sm",
  onExport,
  emptyMessage = "보낼 검색 결과가 없습니다.",
  label: labelOverride,
  title = "현재 검색·필터 결과를 엑셀로보냅니다",
}: Props) {
  const handleClick = async () => {
    if (count === 0) {
      toast.error(emptyMessage);
      return;
    }
    try {
      await onExport();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "엑셀보내기 실패");
    }
  };

  const baseLabel = labelOverride ?? "검색결과 엑셀";
  const label =
    count != null && count > 0 ? `${baseLabel} (${count})` : baseLabel;

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={disabled || loading || count === 0}
      leftIcon={loading ? <Loader2 size={size === "xs" ? 12 : 14} className="animate-spin" /> : <FileDown size={size === "xs" ? 12 : 14} />}
      onClick={() => void handleClick()}
      title={title}
    >
      {label}
    </Button>
  );
}
