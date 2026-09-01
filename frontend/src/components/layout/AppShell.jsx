import { Outlet } from "react-router-dom";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";
import SimulationControls from "../dashboard/SimulationControls.jsx";
import "../../app/app.css";

export default function AppShell() {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <SimulationControls />
          <div className="main-inner page-motion">
            <Outlet />
            <footer className="footer">
              NWIS M1.0 consumes the M0.9 API as a read-only replay surface. Analytical records remain
              historical-source data unless the backend states otherwise.
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
