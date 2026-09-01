import "./ui.css";

export default function Tooltip({ label, children }) {
  return <span title={label}>{children}</span>;
}
