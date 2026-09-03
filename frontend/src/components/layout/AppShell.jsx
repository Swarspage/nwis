import { Outlet } from "react-router-dom";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";
import Footer from "./Footer.jsx";
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
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}
