import { NavLink } from "react-router-dom";

const navItems = [
  ["Overview", "/", "01"],
  ["Telemetry", "/telemetry", "02"],
  ["Features", "/features", "03"],
  ["Intelligence", "/intelligence", "04"],
  ["Models", "/models", "05"],
  ["Risk", "/risk", "06"],
  ["Historical", "/historical", "07"],
  ["Replay", "/replay", "08"],
];

export default function Sidebar() {
  return (
    <div className="sidebar-container">
      <aside className="sidebar">
        <p className="sidebar-label">Navigation</p>
        <nav className="sidebar-nav" aria-label="NWIS sections">
          {navItems.map(([label, to, icon]) => (
            <NavLink key={to} to={to} end={to === "/"} className="nav-item soft-transition">
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              <span className="nav-text">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="depth-rail"></div>
    </div>
  );
}
