import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { label } from "@/lib/validation";
import { CorrectionForm, EvidenceForm, ReviewForm } from "@/app/forms";
export const dynamic = "force-dynamic";
export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id.length > 100) notFound();
  const [claim, user] = await Promise.all([
    db.claim.findUnique({
      where: { id },
      include: {
        author: { select: { displayName: true } },
        evidence: {
          orderBy: { createdAt: "asc" },
          include: {
            source: { select: { url: true } },
            submittedBy: { select: { displayName: true } },
          },
        },
        revisions: {
          orderBy: { version: "desc" },
          include: { author: { select: { displayName: true } } },
        },
      },
    }),
    currentUser(),
  ]);
  if (!claim) notFound();
  return (
    <>
      <Link className="back" href="/">
        ← All claims
      </Link>
      <section className="claim-heading">
        <div className="card-meta">
          <span className={`badge status-${claim.status.toLowerCase()}`}>
            {label(claim.status)}
          </span>
          <span className="muted">
            {label(claim.kind)} · Version {claim.version}
          </span>
        </div>
        <h1>{claim.title}</h1>
        <p className="preserve intro">{claim.description}</p>
        <p className="muted small">
          Submitted by {claim.author.displayName} ·{" "}
          {claim.createdAt.toISOString().slice(0, 10)} (UTC)
        </p>
        <div className="notice">
          This status is a provisional human assessment. A linked source is not
          proof by itself. Examine attribution, relevance, and competing
          explanations.
        </div>
      </section>
      <div className="detail-grid">
        <div>
          <section>
            <h2>
              Evidence & sources{" "}
              <span className="count">{claim.evidence.length}</span>
            </h2>
            {claim.evidence.map((e, i) => (
              <article className="panel evidence" key={e.id}>
                <p className="eyebrow">
                  Source {String(i + 1).padStart(2, "0")} · {label(e.relation)}{" "}
                  (contributor assessment)
                </p>
                <h3>{e.attribution}</h3>
                <a
                  className="source-link"
                  href={e.source.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  {e.source.url}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <p className="preserve">{e.note}</p>
                <p className="muted small">
                  Attached by {e.submittedBy.displayName} ·{" "}
                  {e.createdAt.toISOString().slice(0, 10)} (UTC) · Content not
                  automatically retrieved or verified
                </p>
              </article>
            ))}
          </section>
          {user && (
            <details className="panel">
              <summary>Attach another source</summary>
              <EvidenceForm id={id} />
            </details>
          )}
          {user && (user.id === claim.authorId || user.role === "REVIEWER") && (
            <details className="panel">
              <summary>Publish a correction</summary>
              <CorrectionForm
                claim={{
                  id,
                  title: claim.title,
                  description: claim.description,
                  kind: claim.kind,
                  version: claim.version,
                }}
              />
            </details>
          )}
          {user?.role === "REVIEWER" && (
            <details className="panel">
              <summary>Review this claim</summary>
              <ReviewForm
                id={id}
                version={claim.version}
                status={claim.status}
              />
            </details>
          )}
          {!user && (
            <p className="muted">
              Contributions require{" "}
              <Link href="/dev-login">development sign-in</Link>.
            </p>
          )}
        </div>
        <aside>
          <h2>Revision history</h2>
          <p className="muted small">
            Corrections and review decisions remain visible. Times are UTC.
          </p>
          <ol className="timeline">
            {claim.revisions.map((r) => (
              <li key={r.id}>
                <div className="card-meta">
                  <strong>Version {r.version}</strong>
                  <span className="badge">{label(r.status)}</span>
                </div>
                <p className="preserve">{r.reason}</p>
                <p className="muted small">
                  {r.author.displayName} ·{" "}
                  <time dateTime={r.createdAt.toISOString()}>
                    {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </time>
                </p>
                <details>
                  <summary>Read this version</summary>
                  <h3>{r.title}</h3>
                  <p className="muted small">{label(r.kind)}</p>
                  <p className="preserve">{r.description}</p>
                </details>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
