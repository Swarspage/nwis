import "./ui.css";

export default function LoadingState({ lines = 4 }) {
  return (
    <div className="state-panel loading-stack" aria-label="Loading">
      {Array.from({ length: lines }).map((_, index) => (
        <span
          key={index}
          className="loading-line"
          style={{ width: `${92 - index * 12}%` }}
        />
      ))}
    </div>
  );
}
