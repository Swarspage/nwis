import "./ui.css";

export default function EmptyState({ title = "No records available", children }) {
  return (
    <div className="state-panel">
      <h3 className="state-title">{title}</h3>
      {children ? <p className="state-copy">{children}</p> : null}
    </div>
  );
}
