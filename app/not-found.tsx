import Link from "next/link";
export default function NotFound() {
  return (
    <section className="narrow">
      <h1>Claim not found</h1>
      <p>The requested record does not exist.</p>
      <Link href="/">Browse claims</Link>
    </section>
  );
}
