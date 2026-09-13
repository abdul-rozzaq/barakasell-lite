// Decorative "+" crosshair registration marks on primary CTAs / cards, per
// the design handoff's "blueprint/wireframe" aesthetic. Purely decorative —
// safe to render inside any relatively-positioned container.
export function CornerMarks() {
  const barBase = "absolute bg-[rgba(29,31,32,0.55)]";
  const positions = [
    "top-0 left-0",
    "top-0 right-0",
    "bottom-0 left-0",
    "bottom-0 right-0",
  ];
  return (
    <>
      {positions.map((pos) => (
        <span key={pos} className={`pointer-events-none absolute ${pos} h-[11px] w-[11px]`}>
          <span className={`${barBase} left-0 top-1/2 h-px w-full -translate-y-1/2`} />
          <span className={`${barBase} top-0 left-1/2 w-px h-full -translate-x-1/2`} />
        </span>
      ))}
    </>
  );
}
