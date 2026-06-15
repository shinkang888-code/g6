import { DashboardSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-6 max-w-screen-2xl mx-auto">
      <DashboardSkeleton />
    </div>
  );
}
