import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { SessionProvider } from "./auth/context";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Élément #root introuvable");
}

createRoot(root).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
