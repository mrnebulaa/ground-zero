import Link from "next/link";
import "./globals.css";
export const metadata = {
  title: {
    default: "Ground Zero · Evidence commons",
    template: "%s · Ground Zero",
  },
  description:
    "Inspect evidence, question claims, and follow public corrections.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <div className="shell">
          <header className="site-header">
            <Link className="brand" href="/">
              ◎ <span>GROUND ZERO</span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/">Claims</Link>
              <Link href="/claims/new">Submit a claim</Link>
              <Link href="/dev-login">Local access</Link>
            </nav>
          </header>
          <div className="prototype">
            <span className="dot" /> LOCAL PROTOTYPE{" "}
            <span>
              Public submissions are disabled by default. No claims are
              automatically verified.
            </span>
          </div>
          <main id="content">{children}</main>
          <footer>
            <strong>Evidence over popularity.</strong>
            <p>Open source · Nonpartisan governance · Human oversight</p>
            <p>
              Review labels are provisional assessments, not guarantees of
              truth. Inspect the sources and their limitations.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
