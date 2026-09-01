import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useApiResource } from "../api/hooks.js";
import EvidenceSummary from "../components/dashboard/EvidenceSummary.jsx";
import ModelEvidence from "../components/dashboard/ModelEvidence.jsx";
import ReplayControls from "../components/dashboard/ReplayControls.jsx";
import RiskSummary from "../components/dashboard/RiskSummary.jsx";
import Card from "../components/ui/Card.jsx";
import DataTable from "../components/ui/DataTable.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import Metric from "../components/ui/Metric.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import Timeline from "../components/ui/Timeline.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { useAppState } from "../app/AppState.jsx";
import { formatTimestamp, formatValue, measurementRows } from "../utils/format.js";

export default function Replay() {
  const { selectedTimestamp, setSelectedTimestamp, selectedWell } = useAppState();
  const timeline = useApiResource(() => api.riskTimeline({ limit: 51 }, selectedWell), [selectedWell]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(900);

  const records = timeline.data?.records || [];
  const timestamp = records[index]?.timestamp;
  const snapshot = useApiResource(() => (timestamp ? api.snapshot(timestamp, selectedWell) : Promise.resolve(null)), [timestamp, selectedWell]);

  useEffect(() => {
    setSelectedTimestamp(timestamp || null);
  }, [setSelectedTimestamp, timestamp]);

  useEffect(() => {
    if (!playing || !records.length) return undefined;
    const timer = window.setTimeout(() => {
      setIndex((current) => {
        if (current >= records.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, speed);
    return () => window.clearTimeout(timer);
  }, [playing, records.length, speed, index]);

  const telemetryRows = useMemo(() => measurementRows(snapshot.data?.telemetry), [snapshot.data]);

  if (timeline.state === "loading") return <LoadingState lines={5} />;
  if (timeline.state === "error") return <ErrorState error={timeline.error} />;
  if (!records.length) return <ErrorState title="Replay unavailable" error={new Error("No timeline records returned by the API.")} />;

  const stepBack = () => setIndex((current) => Math.max(0, current - 1));
  const stepForward = () => setIndex((current) => Math.min(records.length - 1, current + 1));

  return (
    <div className="page">
      <PageHeader
        kicker="Chronological replay"
        title="Replay"
        description="Playback steps through backend risk timestamps and requests snapshots for the selected time. Future records are not read into the selected snapshot."
      />

      <Card>
        <SectionHeader
          title="Replay Timeline"
          description={formatTimestamp(timestamp)}
          action={<ReplayControls playing={playing} onPlayPause={() => setPlaying((value) => !value)} onStepBack={stepBack} onStepForward={stepForward} speed={speed} onSpeedChange={setSpeed} />}
        />
        <Timeline index={index} count={records.length} start={records[0]?.timestamp} end={records[records.length - 1]?.timestamp} />
      </Card>

      {snapshot.state === "loading" ? <LoadingState lines={5} /> : null}
      {snapshot.state === "error" ? <ErrorState error={snapshot.error} /> : null}
      {snapshot.state === "success" && snapshot.data ? (
        <>
          <RiskSummary risk={snapshot.data.risk} />

          <div className="card-grid">
            <div className="span-6">
              <Card>
                <SectionHeader title="Current Telemetry" description={`Snapshot timestamp ${formatTimestamp(snapshot.data.timestamp)}`} />
                <DataTable
                  rows={telemetryRows}
                  columns={[
                    { key: "name", header: "Parameter" },
                    { key: "value", header: "Value", render: (row) => formatValue(row.value) },
                    { key: "quality", header: "Status" },
                  ]}
                />
              </Card>
            </div>
            <div className="span-6">
              <Card>
                <SectionHeader title="Snapshot Provenance" description="Combined snapshot assembled by the backend." />
                <div className="card-grid">
                  <div className="span-6"><Metric label="Effective timestamp" value={formatTimestamp(snapshot.data.timestamp)} /></div>
                  <div className="span-6"><Metric label="Data origin" value={snapshot.data.provenance?.data_origin || "Unknown"} /></div>
                  <div className="span-6"><Metric label="Historical context" value={snapshot.data.historical_context?.available ? "Available" : "Unavailable"} /></div>
                  <div className="span-6"><Metric label="Model records" value={formatValue(snapshot.data.models?.length)} /></div>
                </div>
              </Card>
            </div>
          </div>

          <EvidenceSummary intelligence={snapshot.data.intelligence} risk={snapshot.data.risk} />
          <ModelEvidence records={snapshot.data.models || []} prototype={snapshot.data.risk?.prototype_supervised} />
        </>
      ) : null}
    </div>
  );
}
