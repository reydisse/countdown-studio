export function CueMarker({ label, color }) {
  return (
    <div className="flex items-center gap-2 my-3 select-none pointer-events-none">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs font-semibold tracking-widest uppercase opacity-70" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
