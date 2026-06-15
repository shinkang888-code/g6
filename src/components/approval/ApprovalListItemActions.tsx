"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  isSoftDeleted: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deleteLoading?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
};

export function ApprovalListItemActions({
  isSoftDeleted,
  canEdit,
  canDelete,
  deleteLoading,
  onEdit,
  onDelete,
  className,
}: Props) {
  if (!canEdit && !canDelete) return null;

  return (
    <div
      className={cn("flex flex-col items-end gap-1.5 mt-1.5", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {canEdit && !isSoftDeleted && (
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="min-h-[32px] px-3 text-xs"
          leftIcon={<Pencil size={12} />}
          onClick={onEdit}
        >
          수정
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          size="xs"
          variant={isSoftDeleted ? "danger" : "outline"}
          className={cn(
            "min-h-[32px] px-3 text-xs",
            isSoftDeleted ? "border-danger-300 text-danger-700 hover:bg-danger-50" : "text-slate-600"
          )}
          leftIcon={<Trash2 size={12} />}
          onClick={onDelete}
          disabled={deleteLoading}
          loading={deleteLoading}
        >
          {isSoftDeleted ? "영구삭제" : "삭제"}
        </Button>
      )}
    </div>
  );
}
