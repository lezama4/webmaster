import Link from "next/link";

const STEPS = [
  {
    n: "01",
    role: "Hospitals",
    text: "Open a slot in the ward's agenda — a date, a time, a place where patients could use some company.",
  },
  {
    n: "02",
    role: "Artists",
    text: "Browse open slots and propose an activity: music, storytelling, magic, a workshop.",
  },
  {
    n: "03",
    role: "Coordinators",
    text: "The hospital reviews proposals and confirms one. The moment becomes a scheduled event.",
  },
  {
    n: "04",
    role: "Families",
    text: "Patients and their families see what's coming up, and share how it went.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero — asymmetric, left-aligned copy beside a warm composed visual. */}
      <section className="grid items-center gap-10 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
        <div className="flex flex-col items-start gap-6">
          <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            Non-profit · free for everyone involved
          </span>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Fewer empty hours,
            <br />
            <span className="text-primary">more live moments.</span>
          </h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted">
            Long hospital stays are full of waiting. Vivetutiempo connects
            hospitals with artists so patients and their families get real
            performances — not a screen — during that time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/events"
              className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:bg-primary-hover active:translate-y-px"
            >
              Browse upcoming events
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-border bg-surface px-6 py-3 font-medium transition-all hover:border-foreground/30 active:translate-y-px"
            >
              Register a hospital or profile
            </Link>
          </div>
        </div>

        <div className="relative aspect-square w-full">
          <div className="absolute inset-0 rounded-3xl bg-surface-2" />
          <div className="absolute left-6 top-8 h-40 w-40 rounded-3xl bg-primary/15" />
          <div className="absolute bottom-10 right-8 h-48 w-48 rounded-full bg-accent/20" />
          <div className="absolute inset-x-10 bottom-12 top-16 rounded-3xl border border-border bg-surface shadow-[0_24px_48px_-24px_rgba(42,33,28,0.25)]" />
          <div className="absolute inset-x-16 bottom-20 top-24 flex flex-col justify-end gap-2">
            <span className="h-2 w-2/3 rounded-full bg-primary/40" />
            <span className="h-2 w-1/2 rounded-full bg-foreground/10" />
            <span className="h-2 w-3/5 rounded-full bg-foreground/10" />
          </div>
        </div>
      </section>

      {/* How it works — a single flow, not three equal cards; divide-y rows. */}
      <section className="grid gap-10 border-t border-border py-16 md:grid-cols-[0.8fr_1.2fr] md:py-20">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            How a moment comes together
          </h2>
          <p className="mt-3 max-w-[40ch] text-muted">
            Four people, one shared afternoon. Every step is reviewed before it
            reaches a patient.
          </p>
        </div>
        <ol className="divide-y divide-border">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-5 py-5 first:pt-0 last:pb-0">
              <span className="font-mono text-sm text-primary">{step.n}</span>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{step.role}</span>
                <span className="text-muted">{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
