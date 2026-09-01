import { formatTimestamp } from "../../utils/format.js";
import "./ui.css";

export default function Timeline({ index = 0, count = 0, start, end }) {
  const progress = count <= 1 ? 0 : Math.max(0, Math.min(100, (index / (count - 1)) * 100));

  return (
    <div className="timeline">
      <div className="timeline-track" aria-label="Replay progress">
        <div className="timeline-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="timeline-meta">
        <span>{formatTimestamp(start)}</span>
        <span>{count ? `${index + 1} / ${count}` : "0 / 0"}</span>
        <span>{formatTimestamp(end)}</span>
      </div>
    </div>
  );
}
