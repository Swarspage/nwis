import "./ui.css";

export default function Card({ children, dark = false, className = "" }) {
  return <section className={`card ${dark ? "card-dark" : ""} ${className}`}>{children}</section>;
}
