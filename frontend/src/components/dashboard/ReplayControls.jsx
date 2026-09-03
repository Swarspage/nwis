import Button from "../ui/Button.jsx";
import { HiPlay, HiPause, HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import "./dashboard.css";

export default function ReplayControls({ playing, onPlayPause, onStepBack, onStepForward, speed, onSpeedChange }) {
  return (
    <div className="replay-controls">
      <button className="timeline-button" type="button" aria-label="Step backward" onClick={onStepBack} title="Step Backward">
        <HiChevronLeft />
      </button>

      <Button variant="primary" onClick={onPlayPause} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {playing ? <HiPause /> : <HiPlay />}
        <span>{playing ? "Pause" : "Play"}</span>
      </Button>

      <button className="timeline-button" type="button" aria-label="Step forward" onClick={onStepForward} title="Step Forward">
        <HiChevronRight />
      </button>

      <select className="speed-select" value={speed} onChange={(event) => onSpeedChange(Number(event.target.value))} aria-label="Replay speed">
        <option value={1600}>0.5x Speed</option>
        <option value={900}>1.0x Speed</option>
        <option value={450}>2.0x Speed</option>
      </select>
    </div>
  );
}
