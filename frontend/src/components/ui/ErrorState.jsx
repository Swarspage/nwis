import "./ui.css";

export default function ErrorState({ title = "Backend unavailable", error }) {
  return (
    <div className="state-panel">
      <h3 className="state-title">{title}</h3>
      <p className="state-copy">{error?.message || "The requested API data could not be loaded."}</p>
    </div>
  );
}
