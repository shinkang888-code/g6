import { Suspense } from "react";
import { CaseRowSkeleton } from "@/components/ui/skeleton";

export default function CasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-full">
          <div className="bg-white border-b border-slate-200 px-6 py-4">
            <div className="skeleton-shimmer h-7 w-48 rounded-md mb-2" />
            <div className="skeleton-shimmer h-4 w-32 rounded-md" />
          </div>
          <table className="w-full">
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <CaseRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
