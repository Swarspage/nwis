import { HiOutlineGlobeAlt, HiOutlineServer, HiOutlineShieldCheck, HiOutlineCpuChip } from "react-icons/hi2";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Left: Brand & Disclaimer */}
        <div className="footer-brand-section">
          <div className="footer-brand-header">
            <span className="footer-brand-name">Nearby Wells Intelligence System</span>
            <span className="footer-badge">M1.0 PRO</span>
          </div>
          <p className="footer-disclaimer">
            NWIS M1.0 consumes the M0.9 API as a read-only replay surface. Analytical records remain
            historical-source data unless explicit live backend simulation is active.
          </p>
        </div>

        {/* Center: System Subservices */}
        <div className="footer-services-section">
          <div className="service-item">
            <HiOutlineServer style={{ color: "#0284c7" }} />
            <span className="service-name">API Gateway</span>
            <span className="service-dot" />
          </div>
          <div className="service-item">
            <HiOutlineGlobeAlt style={{ color: "#059669" }} />
            <span className="service-name">Telemetry Stream</span>
            <span className="service-dot" />
          </div>
          <div className="service-item">
            <HiOutlineCpuChip style={{ color: "#7c3aed" }} />
            <span className="service-name">ML Risk Engine</span>
            <span className="service-dot" />
          </div>
          <div className="service-item">
            <HiOutlineShieldCheck style={{ color: "#d97706" }} />
            <span className="service-name">Replay Pipeline</span>
            <span className="service-dot" />
          </div>
        </div>

        {/* Right: Meta & Timezone */}
        <div className="footer-meta-section">
          <div className="footer-clock-box">
            <span>UTC+05:30</span>
            <span>•</span>
            <span>SYSTEM ACTIVE</span>
          </div>
          <div className="footer-copyright">
            © {new Date().getFullYear()} NWIS Enterprise • All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
