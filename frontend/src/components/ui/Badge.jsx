import "./ui.css";

export default function Badge({ children, tone = "default", className = "" }) {
  const toneClass = 
    tone === "strong" ? "badge-live" : 
    tone === "moss" ? "badge-moss" : 
    tone === "brass" ? "badge-brass" :
    tone === "rust" ? "badge-rust" :
    tone === "outline" ? "badge-outline" : "";
    
  return <span className={`badge ${toneClass} ${className}`}>{children}</span>;
}
