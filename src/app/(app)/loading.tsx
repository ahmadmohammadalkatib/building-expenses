import { Skeleton } from "@/components/ui";

/** Shown while a screen's server data loads. */
export default function Loading() {
  return (
    <div aria-busy="true" className="animate-fade-in">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="hidden h-9 w-32 rounded-lg sm:block" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5 shadow-xs">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="divide-y divide-border">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
