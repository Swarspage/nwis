import "./ui.css";

export default function SectionHeader({ title, description, action }) {
  return (
    <div className="section-header">
      <div className="section-title-group">
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
