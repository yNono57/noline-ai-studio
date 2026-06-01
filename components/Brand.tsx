export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-md bg-noline-orange text-sm font-black text-noline-black">
        N
      </div>
      <div>
        <p className="text-sm font-black tracking-[0.24em] text-white">NØLINE</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-noline-muted">
          AI Studio
        </p>
      </div>
    </div>
  );
}
