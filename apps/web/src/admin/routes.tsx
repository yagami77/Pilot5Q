/** Routes de l'espace du responsable national (`/responsable/...`). */
import { Navigate, Route } from "react-router";

import { AdminLayout } from "./AdminLayout";
import { AdminPrint } from "./AdminPrint";
import { Calendar } from "./Calendar";
import { Clubs } from "./Clubs";
import { Dashboard } from "./Dashboard";
import { Players } from "./Players";
import { Ranking } from "./Ranking";
import { Settings } from "./Settings";
import { StagePage } from "./StagePage";

export function adminRoutes() {
  return [
    <Route key="print" path="/responsable/imprimer/:doc/:stageId?" element={<AdminPrint />} />,
    <Route key="admin" path="/responsable" element={<AdminLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="calendrier" element={<Calendar />} />
      <Route path="clubs" element={<Clubs />} />
      <Route path="joueurs" element={<Players />} />
      <Route path="classement" element={<Ranking />} />
      <Route path="parametres" element={<Settings />} />
      <Route path="tn/:stageId" element={<StagePage />} />
      <Route path="*" element={<Navigate to="/responsable" replace />} />
    </Route>,
  ];
}
