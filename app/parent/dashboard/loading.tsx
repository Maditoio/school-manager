export default function ParentDashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="h-12 max-w-sm animate-pulse rounded-[6px] bg-(--surface-soft)" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-[10px] border border-(--border-subtle) bg-(--surface)" />
        <div className="h-24 animate-pulse rounded-[10px] border border-(--border-subtle) bg-(--surface)" />
        <div className="h-24 animate-pulse rounded-[10px] border border-(--border-subtle) bg-(--surface)" />
      </div>
      <div className="h-48 animate-pulse rounded-[10px] border border-(--border-subtle) bg-(--surface)" />
      <div className="h-40 animate-pulse rounded-[10px] border border-(--border-subtle) bg-(--surface)" />
    </div>
  )
}
