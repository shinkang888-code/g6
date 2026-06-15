"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  caseNumber: string;
  title?: string;
  description?: string;
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  caseNumber,
  title = "사건을 삭제하시겠습니까?",
  description,
}: ConfirmDeleteModalProps) {
  const [inputValue, setInputValue] = useState("");
  const isMatch = inputValue.trim() === caseNumber.trim();

  const handleConfirm = () => {
    if (!isMatch) return;
    onConfirm();
    setInputValue("");
    onClose();
  };

  const handleClose = () => {
    setInputValue("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-danger-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={18} className="text-danger-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{title}</h3>
                    <p className="text-sm text-text-muted mt-1">
                      {description || "이 작업은 되돌릴 수 없습니다. 모든 관련 데이터(기일, 메모, 문서)가 영구 삭제됩니다."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 ml-2"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Input area */}
              <div className="px-6 pb-6">
                <div className="bg-danger-50 border border-danger-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-danger-700 font-medium mb-2">
                    삭제를 확인하려면 아래에 사건번호를 정확히 입력하세요:
                  </p>
                  <div className="font-mono text-base font-bold text-danger-800 bg-white border border-danger-200 rounded-lg px-3 py-1.5 inline-block">
                    {caseNumber}
                  </div>
                </div>

                <div className="mb-4">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={`"${caseNumber}" 입력`}
                    autoFocus
                    className={cn(
                      "w-full px-3 py-2.5 text-sm border rounded-lg outline-none transition-all font-mono",
                      isMatch && inputValue
                        ? "border-danger-500 bg-danger-50 ring-2 ring-danger-500/20"
                        : inputValue
                        ? "border-slate-300 bg-white"
                        : "border-slate-200 bg-slate-50 focus:border-slate-400 focus:bg-white"
                    )}
                  />
                  {inputValue && !isMatch && (
                    <p className="text-xs text-danger-500 mt-1">
                      입력한 사건번호가 일치하지 않습니다.
                    </p>
                  )}
                  {isMatch && (
                    <p className="text-xs text-danger-600 font-medium mt-1 flex items-center gap-1">
                      <span className="w-3 h-3 bg-danger-500 rounded-full inline-flex items-center justify-center">
                        <span className="text-white text-2xs">✓</span>
                      </span>
                      일치합니다. 삭제 버튼이 활성화됩니다.
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={!isMatch}
                    onClick={handleConfirm}
                    className={cn(
                      "flex-1 transition-all",
                      !isMatch && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    영구 삭제
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    취소
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
