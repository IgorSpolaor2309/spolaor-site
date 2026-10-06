import { Reveal } from "@/components/ui/reveal";

export type Feature = { title: string; text: string; tag?: string };

export function FeatureGrid({ items, cols = 3 }: { items: Feature[]; cols?: 2 | 3 }) {
  return (
    <ul className={`grid gap-px overflow-hidden rounded-[28px] border border-line bg-line sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}>
      {items.map((f, i) => (
        <Reveal as="li" key={f.title} delay={(i % 3) * 0.06} className="group bg-ink-950 p-7 transition-colors duration-500 hover:bg-ink-900 md:p-8">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-dim">{String(i + 1).padStart(2, "0")}</span>
            {f.tag && <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-[0.7rem] text-muted">{f.tag}</span>}
          </div>
          <h3 className="mt-6 text-xl font-medium tracking-tight">{f.title}</h3>
          <p className="mt-2 leading-relaxed text-muted">{f.text}</p>
        </Reveal>
      ))}
    </ul>
  );
}

export function SectionIntro({ label, title, text, id }: { label: React.ReactNode; title: React.ReactNode; text?: string; id?: string }) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
      <Reveal className="lg:col-span-7">
        {label}
        <h2 id={id} className="mt-6 text-h2 font-medium">
          {title}
        </h2>
      </Reveal>
      {text && (
        <Reveal delay={0.1} className="lg:col-span-5">
          <p className="text-lg leading-relaxed text-muted">{text}</p>
        </Reveal>
      )}
    </div>
  );
}
