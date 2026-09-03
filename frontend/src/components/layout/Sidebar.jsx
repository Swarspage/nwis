import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  HiOutlineSquares2X2,
  HiOutlineChartBar,
  HiOutlineSquare3Stack3D,
  HiOutlineCpuChip,
  HiOutlineShieldExclamation,
  HiOutlineClock,
  HiOutlinePlayCircle,
  HiOutlineCube,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineSignal,
  HiOutlineLightBulb
} from "react-icons/hi2";
import "./Sidebar.css";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { 
        label: "Overview", 
        to: "/", 
        icon: HiOutlineSquares2X2, 
        end: true 
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { 
        label: "Telemetry", 
        to: "/telemetry", 
        icon: HiOutlineChartBar,
        badge: { text: "LIVE", type: "live" } 
      },
      { 
        label: "Features", 
        to: "/features", 
        icon: HiOutlineSquare3Stack3D 
      },
      { 
        label: "Intelligence", 
        to: "/intelligence", 
        icon: HiOutlineCpuChip,
        badge: { text: "AI", type: "ai" }
      },
      { 
        label: "Risk", 
        to: "/risk", 
        icon: HiOutlineShieldExclamation,
        badge: { text: "Active", type: "warning" }
      },
      {
        label: "Engineering Guidance",
        to: "/guidance",
        icon: HiOutlineLightBulb
      },
    ],
  },

  {
    label: "Knowledge",
    items: [
      { 
        label: "Historical", 
        to: "/historical", 
        icon: HiOutlineClock 
      },
      { 
        label: "Replay", 
        to: "/replay", 
        icon: HiOutlinePlayCircle 
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      { 
        label: "Models", 
        to: "/models", 
        icon: HiOutlineCube 
      },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <div className={`sidebar-container ${collapsed ? "collapsed" : "expanded"}`}>
      <aside className="sidebar" aria-label="Main Navigation">
        <div className="sidebar-content">
          {NAV_GROUPS.map((group, groupIdx) => (
            <div key={group.label} className="sidebar-group">
              {!collapsed && (
                <div className="sidebar-label-wrapper">
                  <p className="sidebar-label">{group.label}</p>
                </div>
              )}

              {collapsed && groupIdx > 0 && <div className="sidebar-divider" />}

              <nav className="sidebar-nav" aria-label={`${group.label} navigation`}>
                {group.items.map(({ label, to, icon: Icon, end, badge }) => (
                  <div key={to} className="nav-item-wrapper">
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? "active" : ""}`
                      }
                      title={collapsed ? label : undefined}
                    >
                      <span className="nav-icon" aria-hidden="true">
                        <Icon />
                      </span>
                      {!collapsed && <span className="nav-text">{label}</span>}
                      {!collapsed && badge && (
                        <span className={`nav-badge ${badge.type}`}>
                          {badge.type === "live" && <span className="nav-badge-pulse" />}
                          {badge.text}
                        </span>
                      )}
                    </NavLink>
                    {collapsed && <span className="nav-tooltip">{label}</span>}
                  </div>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Sidebar Footer with System Status & Collapse Toggle */}
        <div className="sidebar-footer">
          {!collapsed && (
            <div className="system-status-card" title="Telemetry Feed Online">
              <span className="status-indicator-dot" />
              <div className="status-info">
                <span className="status-title">System Operational</span>
                <span className="status-subtitle">NWIS Core v1.0 • 12ms</span>
              </div>
            </div>
          )}

          <button
            type="button"
            className="collapse-toggle-btn"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <HiChevronRight /> : <HiChevronLeft />}
            {!collapsed && <span>Collapse Sidebar</span>}
          </button>
        </div>
      </aside>
      <div className="depth-rail" />
    </div>
  );
}
