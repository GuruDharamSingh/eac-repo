import Link from "next/link";
import { ReadingImportWizard } from "@elkdonis/reading-wizard";

export default function ImportPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">4W</span>
          <span>
            <strong>4th Way Book Readers</strong>
            <span>Importer</span>
          </span>
        </Link>
        <nav className="header-actions" aria-label="Primary">
          <Link href="/">Dashboard</Link>
          <a href="#wizard">Wizard</a>
        </nav>
      </header>

      <div className="admin-page" id="wizard">
        <div className="wizard-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Book import wizard</h1>
          </div>
          <Link className="button button-secondary" href="/">Back to Dashboard</Link>
        </div>
        <section className="wizard-shell">
          <ReadingImportWizard />
        </section>
      </div>
    </main>
  );
}