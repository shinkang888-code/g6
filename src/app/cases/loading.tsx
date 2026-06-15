import { CaseRowSkeleton } from "@/components/ui/skeleton";

export default function CasesLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="skeleton-shimmer h-7 w-48 rounded-md mb-2" />
        <div className="skeleton-shimmer h-4 w-32 rounded-md" />
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {Array.from({ length: 8 }).map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <div className="skeleton-shimmer h-3 w-16 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }).map((_, i) => (
              <CaseRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
