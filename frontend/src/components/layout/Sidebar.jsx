import { NavLink } from "react-router-dom";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Overview", to: "/", icon: "◈", end: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Telemetry", to: "/telemetry", icon: "◎" },
      { label: "Features", to: "/features", icon: "◫" },
      { label: "Intelligence", to: "/intelligence", icon: "◉" },
      { label: "Risk", to: "/risk", icon: "◬" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { label: "Historical", to: "/historical", icon: "◷" },
      { label: "Replay", to: "/replay", icon: "◁" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Models", to: "/models", icon: "◧" },
    ],
  },
];

export default function Sidebar() {
  return (
    <div className="sidebar-container">
      <aside className="sidebar">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="sidebar-label">{group.label}</p>
            <nav className="sidebar-nav" aria-label={`${group.label} navigation`}>
              {group.items.map(({ label, to, icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="nav-item soft-transition"
                >
                  <span className="nav-icon" aria-hidden="true">{icon}</span>
                  <span className="nav-text">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </aside>
      <div className="depth-rail" />
    </div>
  );
}
