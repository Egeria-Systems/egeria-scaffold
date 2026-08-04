import type { ProofPageCopy } from "../content/proof-copy";

export interface CompatibilityPageProps {
  copy: ProofPageCopy;
}

export function CompatibilityPage({ copy }: CompatibilityPageProps) {
  return (
    <main>
      <article aria-labelledby="proof-heading">
        <header>
          <p>{copy.eyebrow}</p>
          <h1 id="proof-heading">{copy.heading}</h1>
          <p>{copy.summary}</p>
        </header>
        <dl>
          {copy.facts.map((fact) => (
            <div key={fact.identifier}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <a href="/api/compatibility">{copy.runtimeReportLink}</a>
      </article>
    </main>
  );
}
