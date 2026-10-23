"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="narrow">
      <h1>Unable to load this record</h1>
      <p>
        Check that your local database is running and migrations have been
        applied.
      </p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
