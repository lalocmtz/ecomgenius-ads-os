import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export default async function HomePage() {
  const user = await currentUser();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-text-primary">
          EcomGenius <span className="text-verdict-winner">Ads OS</span>
        </h1>
        <p className="mt-3 text-text-secondary">
          Motor de decisiones para Meta/TikTok Ads de Feel Ink &amp; Skinglow.
        </p>
      </header>

      {user ? (
        <nav className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/upload"
            className="rounded-lg border border-border bg-bg-raised p-6 transition hover:bg-bg-hover"
          >
            <h2 className="text-lg font-semibold">Subir CSV</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Ingestar exportación de Meta Ads cada 3 días.
            </p>
          </Link>
          <Link
            href="/feel-ink"
            className="rounded-lg border border-border bg-bg-raised p-6 transition hover:bg-bg-hover"
          >
            <h2 className="text-lg font-semibold">Feel Ink</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Dashboard de marca · acciones recomendadas.
            </p>
          </Link>
          <Link
            href="/skinglow"
            className="rounded-lg border border-border bg-bg-raised p-6 transition hover:bg-bg-hover"
          >
            <h2 className="text-lg font-semibold">Skinglow</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Dashboard de marca · acciones recomendadas.
            </p>
          </Link>
        </nav>
      ) : (
        <div className="rounded-lg border border-border bg-bg-raised p-8">
          <h2 className="text-xl font-semibold">Iniciar sesión</h2>
          <p className="mt-2 text-text-secondary">
            Accede con tu cuenta autorizada (Eduardo, Manuel, Oscar).
          </p>
          <Link
            href="/sign-in"
            className="mt-4 inline-block rounded bg-verdict-winner px-4 py-2 font-medium text-bg"
          >
            Entrar
          </Link>
        </div>
      )}
    </main>
  );
}
