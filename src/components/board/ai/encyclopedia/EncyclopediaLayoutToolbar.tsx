// filepath: src/components/board/ai/encyclopedia/EncyclopediaLayoutToolbar.tsx
"use client";

import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { AppWindow, GripVertical, LayoutGrid, Monitor, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EncyclopediaLayoutConfig, EncyclopediaPanelConfig } from "@/lib/legalEncyclopedia/layoutConfig";

type Props = {
  editMode: boolean;
  uiEditMode: boolean;
  layout: EncyclopediaLayoutConfig;
  onToggleEdit: () => void;
  onToggleUiEdit: () => void;
  onSave: () => void;
  onSaveUi: () => void;
  onReset: () => void;
  onResetUi: () => void;
  onReorder: (from: number, to: number) => void;
  onToggleVisible: (id: EncyclopediaPanelConfig["id"]) => void;
};

export function EncyclopediaLayoutToolbar({
  editMode,
  uiEditMode,
  layout,
  onToggleEdit,
  onToggleUiEdit,
  onSave,
  onSaveUi,
  onReset,
  onResetUi,
  onReorder,
  onToggleVisible,
}: Props) {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  };

  return (
    <div className="shrink-0 border-b border-slate-200/80 bg-white/95 px-3 md:px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={editMode ? "primary" : "outline"}
          leftIcon={<LayoutGrid size={14} />}
          onClick={onToggleEdit}
        >
          메뉴편집
        </Button>

        <Button
          size="sm"
          variant={uiEditMode ? "primary" : "outline"}
          leftIcon={<Monitor size={14} />}
          onClick={onToggleUiEdit}
        >
          UI편집
        </Button>

        {editMode && (
          <>
            <Button size="sm" variant="outline" leftIcon={<Save size={14} />} onClick={onSave}>
              메뉴 저장
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<RotateCcw size={14} />} onClick={onReset}>
              메뉴 초기화
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={onToggleEdit}>
              메뉴 편집 종료
            </Button>
          </>
        )}

        {uiEditMode && (
          <>
            <Button size="sm" variant="outline" leftIcon={<Save size={14} />} onClick={onSaveUi}>
              UI 저장
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<RotateCcw size={14} />} onClick={onResetUi}>
              UI 초기화
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={onToggleUiEdit}>
              UI 편집 종료
            </Button>
            <span className="text-[11px] text-sky-800 bg-sky-50 border border-sky-100 px-2 py-1 rounded-lg font-medium flex items-center gap-1">
              <AppWindow size={12} />
              프레임 드래그·크기조절 · 바탕화면 아이콘으로 창 열기
            </span>
          </>
        )}

        {editMode && !uiEditMode && (
          <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg font-medium">
            패널 순서 드래그 · 경계선으로 너비 조절 (그리드 모드)
          </span>
        )}
      </div>

      {editMode && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="encyclopedia-panels" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100"
              >
                {[...layout.panels]
                  .sort((a, b) => a.mobileOrder - b.mobileOrder)
                  .map((panel, index) => (
                    <Draggable key={panel.id} draggableId={panel.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-shadow",
                            panel.visible
                              ? "bg-white border-indigo-200 text-indigo-900"
                              : "bg-slate-50 border-slate-200 text-slate-400",
                            snapshot.isDragging && "shadow-lg ring-2 ring-indigo-300"
                          )}
                        >
                          <span {...dragProvided.dragHandleProps} className="cursor-grab text-slate-400">
                            <GripVertical size={14} />
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleVisible(panel.id)}
                            className="hover:underline"
                          >
                            {panel.label}
                          </button>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                            {panel.widthPercent}%
                          </span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
