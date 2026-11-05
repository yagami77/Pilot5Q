import { MotionConfig } from "motion/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { ToastProvider } from "@/components/Toast";
import { PrintView } from "@/print/PrintView";
import { TournamentProvider } from "@/store/tournament";
import { Cockpit } from "@/views/Cockpit";
import { Home } from "@/views/Home";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <MotionConfig reducedMotion="user">
        <TournamentProvider>
          <ToastProvider>
            <div className="tricolore" aria-hidden="true" />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/tournoi" element={<Navigate to="/tournoi/jeudi" replace />} />
              <Route path="/tournoi/imprimer/:doc" element={<PrintView />} />
              <Route path="/tournoi/:day" element={<Cockpit />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </TournamentProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
