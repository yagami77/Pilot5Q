// Copie dist/index.html vers dist/404.html pour que le routage côté client
// fonctionne sur GitHub Pages (toute URL inconnue sert l'application).
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const index = join(dist, "index.html");

if (!existsSync(index)) {
  console.error(`postbuild : ${index} introuvable, lancer "vite build" d'abord.`);
  process.exit(1);
}

copyFileSync(index, join(dist, "404.html"));
console.log("postbuild : dist/404.html créé.");
