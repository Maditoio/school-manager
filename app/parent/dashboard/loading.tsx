export default function ParentDashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
      <div className="h-28 rounded-2xl bg-white shadow-sm animate-pulse" />
      <div className="h-44 rounded-2xl bg-white shadow-sm animate-pulse" />
      <div className="h-48 rounded-2xl bg-white shadow-sm animate-pulse" />
      <div className="h-44 rounded-2xl bg-white shadow-sm animate-pulse" />
      <div className="h-20 rounded-2xl bg-white shadow-sm animate-pulse" />
    </div>
  )
}
