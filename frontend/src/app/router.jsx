import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "../components/layout/AppShell.jsx";
import Features from "../pages/Features.jsx";
import Historical from "../pages/Historical.jsx";
import Intelligence from "../pages/Intelligence.jsx";
import Models from "../pages/Models.jsx";
import Overview from "../pages/Overview.jsx";
import Replay from "../pages/Replay.jsx";
import Risk from "../pages/Risk.jsx";
import Telemetry from "../pages/Telemetry.jsx";

export default function Router() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="telemetry" element={<Telemetry />} />
        <Route path="features" element={<Features />} />
        <Route path="intelligence" element={<Intelligence />} />
        <Route path="models" element={<Models />} />
        <Route path="risk" element={<Risk />} />
        <Route path="historical" element={<Historical />} />
        <Route path="replay" element={<Replay />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
