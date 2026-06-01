import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, helper, icon: Icon }: StatCardProps) {
  return (
    <div className="surface premium-border rounded-lg p-5 shadow-premium">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-noline-muted">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-md bg-white/8 text-noline-orange">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-noline-muted">{helper}</p>
    </div>
  );
}
