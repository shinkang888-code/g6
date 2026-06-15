"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CaseInstitutionStage } from "@/lib/caseInstitutionTypes";
import {
  getLegalInstitutionCategoryLabel,
  searchLegalInstitutions,
  type LegalInstitutionItem,
} from "@/lib/legalInstitutions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  stage?: CaseInstitutionStage;
  scope?: "all" | "scourt";
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
};

export function AgencyNameAutocomplete({
  value,
  onChange,
  stage,
  scope = "all",
  placeholder = "기관명 일부 입력",
  className,
  inputClassName,
  disabled,
  "aria-invalid": ariaInvalid,
}: Props) {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(
    () =>
      focused && value.trim().length >= 1
        ? searchLegalInstitutions(value, { stage, scope, limit: 12 })
        : [],
    [focused, value, stage, scope]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [value, suggestions.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectSuggestion = useCallback(
    (item: LegalInstitutionItem) => {
      onChange(item.name);
      setOpen(false);
      setFocused(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listboxId : undefined}
        aria-activedescendant={
          showDropdown ? `${listboxId}-option-${activeIndex}` : undefined
        }
        className={cn(
          "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-600/20",
          inputClassName
        )}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (value.trim().length >= 1) setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setFocused(false);
            setOpen(false);
          }, 120);
        }}
        onKeyDown={(e) => {
          if (!showDropdown) {
            if (e.key === "ArrowDown" && value.trim().length >= 1) {
              setOpen(true);
              setFocused(true);
            }
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const picked = suggestions[activeIndex];
            if (picked) selectSuggestion(picked);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
        >
          {suggestions.map((item, index) => (
            <li
              key={item.name}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2",
                  index === activeIndex ? "bg-primary-50 text-primary-900" : "hover:bg-slate-50"
                )}
              >
                <span className="truncate">{item.name}</span>
                <span className="shrink-0 text-[10px] text-text-muted">
                  {getLegalInstitutionCategoryLabel(item.category)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
