import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTO_PRINT_PARAM, openPrintView, printPath, whenPrintReady } from "./launch";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(document, "fonts");
});

/** Remplace `document.fonts` (absent de jsdom) par un faux pilotable. */
function fakeFonts() {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const load = vi.fn(() => gate.then(() => []));
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load, ready: gate },
  });
  return { load, release };
}

describe("ouverture de la vue d'impression", () => {
  it("construit le chemin de la vue A4, avec ou sans impression directe", () => {
    expect(AUTO_PRINT_PARAM).toBe("imprimer");
    expect(printPath(["pointage"])).toBe("/tournoi/imprimer/pointage");
    expect(printPath(["pointage", "schema"], true)).toBe(
      "/tournoi/imprimer/pointage+schema?imprimer=1",
    );
  });

  it("ouvre un nouvel onglet sans « noopener » et signale un onglet bloqué", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(window);
    expect(openPrintView(["schema"], true)).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0]!;
    expect(String(url)).toMatch(/\/tournoi\/imprimer\/schema\?imprimer=1$/);
    expect(target).toBe("_blank");
    // Avec « noopener », window.open renvoie toujours null : l'onglet d'origine partait aussi
    expect(features).toBeUndefined();
    open.mockReturnValue(null);
    expect(openPrintView(["schema"], false)).toBe(false);
    expect(String(open.mock.calls[1]![0])).toMatch(/\/tournoi\/imprimer\/schema$/);
  });
});

describe("document prêt à imprimer", () => {
  it("attend le chargement des polices Geist avant de rendre la main", async () => {
    const fonts = fakeFonts();
    let done = false;
    const ready = whenPrintReady(document, 10_000).then(() => {
      done = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(fonts.load).toHaveBeenCalled();
    expect(fonts.load.mock.calls.map((c) => String((c as unknown[])[0])).join(" ")).toMatch(
      /Geist.*Geist Mono/,
    );
    expect(done).toBe(false);
    fonts.release();
    await ready;
    expect(done).toBe(true);
  });

  it("n'attend pas indéfiniment des polices qui ne viennent pas (club sans réseau)", async () => {
    fakeFonts();
    const started = Date.now();
    await whenPrintReady(document, 120);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("fonctionne sans API de polices", async () => {
    await expect(whenPrintReady(document, 2000)).resolves.toBeUndefined();
  });
});
