import "./ui.css";

export default function Button({ children, variant = "ghost", className = "", ...props }) {
  return (
    <button className={`button button-${variant} soft-transition ${className}`} {...props}>
      {children}
    </button>
  );
}
