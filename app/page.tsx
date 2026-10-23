import Link from "next/link";
import { db } from "@/lib/db";
import { label } from "@/lib/validation";
export const dynamic = "force-dynamic";
export default async function Home() {
  let claims;
  try {
    claims = await db.claim.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        status: true,
        createdAt: true,
        _count: { select: { evidence: true, revisions: true } },
      },
    });
  } catch {
    return (
      <section className="hero">
        <p className="eyebrow">The evidence commons</p>
        <h1>
          Start with a question.
          <br />
          <em>Follow the evidence.</em>
        </h1>
        <div className="panel">
          <h2>Connect your local database</h2>
          <p>
            The claim library needs PostgreSQL. Follow the README to configure
            your environment, start Docker Compose, and apply migrations.
          </p>
          <p className="muted">
            No demonstration claims or invented evidence are shown.
          </p>
        </div>
      </section>
    );
  }
  return (
    <>
      <section className="hero">
        <p className="eyebrow">The evidence commons</p>
        <h1>
          Start with a question.
          <br />
          <em>Follow the evidence.</em>
        </h1>
        <p className="intro">
          An open space to inspect sources, challenge assumptions, and make
          corrections visible. Form your own conclusions.
        </p>
        <Link className="button" href="/claims/new">
          + Submit a claim
        </Link>
      </section>
      <section aria-labelledby="claims-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Explore the record</p>
            <h2 id="claims-heading">
              Recent claims <span className="count">{claims.length}</span>
            </h2>
          </div>
          <p className="muted small">
            Newest first · Up to 50 claims · No popularity ranking
          </p>
        </div>
        {claims.length === 0 ? (
          <div className="empty">
            <span className="empty-icon" aria-hidden="true">
              ◎
            </span>
            <h3>No claims yet</h3>
            <p>
              Start a record with a clear statement and an attributable source.
            </p>
            <p className="muted small">
              This library contains no seeded factual assertions.
            </p>
          </div>
        ) : (
          <div className="claim-grid">
            {claims.map((claim) => (
              <article className="claim-card" key={claim.id}>
                <div className="card-meta">
                  <span
                    className={`badge status-${claim.status.toLowerCase()}`}
                  >
                    {label(claim.status)}
                  </span>
                  <span className="muted small">{label(claim.kind)}</span>
                </div>
                <h3>
                  <Link href={`/claims/${claim.id}`}>{claim.title}</Link>
                </h3>
                <p className="excerpt">{claim.description}</p>
                <div className="card-bottom">
                  <span>
                    {claim._count.evidence} source
                    {claim._count.evidence !== 1 ? "s" : ""} ·{" "}
                    {claim._count.revisions} revision
                    {claim._count.revisions !== 1 ? "s" : ""}
                  </span>
                  <time dateTime={claim.createdAt.toISOString()}>
                    {claim.createdAt.toISOString().slice(0, 10)}
                  </time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <aside className="principles">
        <div>
          <h3>Inspect the source</h3>
          <p>Attribution and context accompany each piece of evidence.</p>
        </div>
        <div>
          <h3>Leave room for uncertainty</h3>
          <p>Evidence, interpretation, opinion, and unknowns stay distinct.</p>
        </div>
        <div>
          <h3>Keep the correction</h3>
          <p>Changes remain part of the public record.</p>
        </div>
      </aside>
    </>
  );
}
