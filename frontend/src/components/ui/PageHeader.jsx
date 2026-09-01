export default function PageHeader({ kicker, title, description, action }) {
  return (
    <header className="page-header">
      {kicker && <p className="metric-label">{kicker}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-xl)", width: "100%" }}>
        <h1 className="page-title">{title}</h1>
        {action && <div>{action}</div>}
      </div>
      {description && <p className="page-description">{description}</p>}
    </header>
  );
}
