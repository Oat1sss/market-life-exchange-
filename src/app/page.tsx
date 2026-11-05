const pillars = [
  {
    title: "A month at a time",
    body: "Salary in, rent out, prices move. Read the report, make one decision, advance.",
  },
  {
    title: "Five fictional markets",
    body: "From steady food stocks to a crypto that trades on sentiment alone. No real money, no real tickers.",
  },
  {
    title: "Life gets a vote",
    body: "Health, knowledge and reputation shape what your money can actually buy you.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-20">
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-muted">
        A life &amp; markets simulation
      </p>
      <h1 className="mt-6 font-serif text-5xl leading-none tracking-tight sm:text-6xl">
        MarketLife
      </h1>
      <p className="mt-5 text-lg text-muted">
        Thirty choices. One lifetime.
      </p>
      <p className="mt-8 max-w-xl leading-7">
        You start with a modest balance, a body that ages, and rent that never
        forgets. Work, study, and trade fictional assets while the market and
        your life try to spend your money faster than it compounds.
      </p>

      <ul className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-3">
        {pillars.map((pillar) => (
          <li key={pillar.title} className="bg-background p-5">
            <h2 className="text-sm font-semibold">{pillar.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{pillar.body}</p>
          </li>
        ))}
      </ul>

      <p className="mt-12 border-t border-border-subtle pt-5 font-mono text-xs text-muted">
        Foundation build · account creation and the first playable month arrive
        in the next phase.
      </p>
    </main>
  );
}
