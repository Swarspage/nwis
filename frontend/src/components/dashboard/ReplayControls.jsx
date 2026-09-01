import Button from "../ui/Button.jsx";
import "./dashboard.css";

export default function ReplayControls({ playing, onPlayPause, onStepBack, onStepForward, speed, onSpeedChange }) {
  return (
    <div className="replay-controls">
      <button className="timeline-button soft-transition" type="button" aria-label="Step backward" onClick={onStepBack}>
        {"<"}
      </button>
      <Button variant="primary" onClick={onPlayPause}>{playing ? "Pause" : "Play"}</Button>
      <button className="timeline-button soft-transition" type="button" aria-label="Step forward" onClick={onStepForward}>
        {">"}
      </button>
      <select className="speed-select" value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))} aria-label="Replay speed">
        <option value={1600}>0.5x</option>
        <option value={900}>1x</option>
        <option value={450}>2x</option>
      </select>
    </div>
  );
}
