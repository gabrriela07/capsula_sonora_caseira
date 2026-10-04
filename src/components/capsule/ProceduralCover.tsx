export function ProceduralCover() {
  return <div className="relative h-full w-full overflow-hidden bg-graphite">
    <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-slime opacity-90 blur-[2px]" />
    <div className="absolute -bottom-28 -right-20 h-80 w-80 rotate-12 rounded-[28%] bg-petal opacity-90" />
    <div className="absolute left-52 top-16 h-52 w-52 rotate-45 rounded-3xl bg-banana opacity-90" />
    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(120deg, transparent 0 18px, rgba(23,23,23,.55) 19px 21px)' }} />
    <div className="absolute bottom-10 left-10 rounded-full border-4 border-carbon/80 bg-carbon/20 p-5 backdrop-blur-sm"><div className="h-16 w-16 rounded-full border-[12px] border-white/90"><div className="m-auto mt-[13px] h-3 w-3 rounded-full bg-slime" /></div></div>
  </div>;
}
