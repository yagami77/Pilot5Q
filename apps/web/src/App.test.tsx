import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("affiche le nom de l'application", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Pilot5Q" })).toBeInTheDocument();
  });
});
