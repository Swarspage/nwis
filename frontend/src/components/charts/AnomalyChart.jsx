/**
 * AnomalyChart — ECharts time-series for M0.5 anomaly_score.
 *
 * Color zones matching design system:
 *   score < 0.4  → moss (normal)
 *   0.4–0.7      → brass (watch)
 *   ≥ 0.7        → rust (elevated)
 *
 * Props:
 *   records   — array of intelligence API records
 *   height    — number (px), default 200
 */
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

const DS = {
  moss: "#2F6F4E",
  brass: "#C77A2E",
  rust: "#B3261E",
  signalTeal: "#1E8A8A",
  mute: "#8C99A6",
  hairline: "#DFE6E3",
  ink: "#0A2540",
  body: "#5B6B7A",
};

function formatTs(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
}

function anomalyColor(score) {
  if (score == null) return DS.mute;
  if (score >= 0.7) return DS.rust;
  if (score >= 0.4) return DS.brass;
  return DS.moss;
}

export default function AnomalyChart({ records = [], height = 200 }) {
  const option = useMemo(() => {
    if (!records.length) return null;

    // Filter records that have an anomaly_score
    const pts = records
      .filter((r) => r.anomaly_score != null)
      .map((r) => [r.timestamp, r.anomaly_score]);

    if (!pts.length) return null;

    const timestamps = pts.map((p) => p[0]);

    return {
      animation: true,
      animationDuration: 220,
      backgroundColor: "transparent",
      grid: { top: 16, right: 16, bottom: 36, left: 52 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: DS.hairline } },
        backgroundColor: "#fff",
        borderColor: DS.hairline,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: DS.ink },
        formatter: (params) => {
          const p = params[0];
          if (!p) return "";
          const score = p.value[1];
          const color = anomalyColor(score);
          return `<div style="font-size:10px;color:${DS.mute}">${formatTs(p.value[0])}</div>
                  <span style="color:${color};font-weight:600">${score != null ? score.toFixed(3) : "—"}</span>`;
        },
      },
      xAxis: {
        type: "category",
        data: timestamps,
        axisLine: { lineStyle: { color: DS.hairline } },
        axisTick: { show: false },
        axisLabel: {
          formatter: formatTs,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: DS.mute,
          interval: Math.max(0, Math.floor(timestamps.length / 5) - 1),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 1,
        interval: 0.25,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: DS.hairline, type: "dashed" } },
        axisLabel: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: DS.mute,
          formatter: (v) => v.toFixed(2),
        },
      },
      series: [
        {
          type: "line",
          data: pts,
          smooth: 0.3,
          symbol: "none",
          lineStyle: { width: 1.5, color: DS.signalTeal },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(30,138,138,0.18)" },
                { offset: 1, color: "rgba(30,138,138,0.01)" },
              ],
            },
          },
          connectNulls: false,
          markArea: {
            silent: true,
            data: [
              [{ yAxis: 0 }, { yAxis: 0.4, itemStyle: { color: "rgba(47,111,78,0.05)" } }],
              [{ yAxis: 0.4 }, { yAxis: 0.7, itemStyle: { color: "rgba(199,122,46,0.05)" } }],
              [{ yAxis: 0.7 }, { yAxis: 1, itemStyle: { color: "rgba(179,38,30,0.05)" } }],
            ],
          },
        },
      ],
    };
  }, [records]);

  if (!records.length || !option) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: DS.mute,
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
        }}
      >
        No anomaly data available
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge={false}
      lazyUpdate={true}
    />
  );
}
