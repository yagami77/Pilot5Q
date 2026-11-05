import { DEFAULT_RULES } from "@pilot5q/domain";
import { BrowserRouter, Route, Routes } from "react-router";

/** Page d'accueil provisoire : le cockpit sera construit par l'agent front. */
function Home() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3px)] max-w-5xl flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-ink-muted text-xs font-semibold tracking-[0.2em] uppercase">
        Billard 5-Quilles · FFB
      </p>
      <h1 className="text-brand text-5xl">Pilot5Q</h1>
      <p className="text-ink-secondary max-w-md text-base font-medium">
        Gestion des Tournois Nationaux. Préqualifications, barrages, National, Masters.
      </p>
      <p className="text-ink-muted font-mono text-sm tabular-nums">
        {DEFAULT_RULES.mastersPrequalified} préqualifiés · barrages à {DEFAULT_RULES.barrageSize} ·
        National à {DEFAULT_RULES.nationalSize}
      </p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="tricolore" aria-hidden="true" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
