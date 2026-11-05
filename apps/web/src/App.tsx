import { MotionConfig } from "motion/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { adminRoutes } from "@/admin/routes";
import { RequireCockpit } from "@/auth/guards";
import { ToastProvider } from "@/components/Toast";
import { PrintView } from "@/print/PrintView";
import { TournamentProvider } from "@/store/tournament";
import { Cockpit } from "@/views/Cockpit";
import { Home } from "@/views/Home";
import { Schema } from "@/views/Schema";

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
              <Route
                path="/tournoi/imprimer/:doc"
                element={
                  <RequireCockpit>
                    <PrintView />
                  </RequireCockpit>
                }
              />
              <Route
                path="/tournoi/schema"
                element={
                  <RequireCockpit>
                    <Schema />
                  </RequireCockpit>
                }
              />
              <Route
                path="/tournoi/:day"
                element={
                  <RequireCockpit>
                    <Cockpit />
                  </RequireCockpit>
                }
              />
              {adminRoutes()}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </TournamentProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}
