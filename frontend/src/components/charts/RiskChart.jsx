/**
 * RiskChart — ECharts time-series for risk score evolution.
 * Color zones: moss (<40), brass (40–69), rust (≥70).
 * Used in Overview timeline strip and Risk page.
 */
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

const DS = {
  moss: "#2F6F4E",
  brass: "#C77A2E",
  rust: "#B3261E",
  mute: "#8C99A6",
  hairline: "#DFE6E3",
  body: "#5B6B7A",
  ink: "#0A2540",
  signalTeal: "#1E8A8A",
};

function riskColor(score) {
  if (score == null) return DS.mute;
  if (score >= 70) return DS.rust;
  if (score >= 40) return DS.brass;
  return DS.moss;
}

function formatTs(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
}

export default function RiskChart({ records = [], height = 200, selectedTimestamp = null }) {
  const option = useMemo(() => {
    if (!records.length) return null;

    const timestamps = records.map((r) => r.timestamp);
    const scores = records.map((r) => r.risk_score ?? null);

    // Color each point segment
    const pieceData = scores.map((s) => riskColor(s));

    // Visual piece zones (background bands)
    const markAreaData = [
      [{ yAxis: 0 }, { yAxis: 40, itemStyle: { color: "rgba(47,111,78,0.06)" } }],
      [{ yAxis: 40 }, { yAxis: 70, itemStyle: { color: "rgba(199,122,46,0.06)" } }],
      [{ yAxis: 70 }, { yAxis: 100, itemStyle: { color: "rgba(179,38,30,0.06)" } }],
    ];

    const markLineData = selectedTimestamp
      ? [
          {
            xAxis: selectedTimestamp,
            lineStyle: { color: DS.signalTeal, type: "solid", width: 1.5 },
            label: { show: false },
          },
        ]
      : [];

    return {
      animation: true,
      animationDuration: 220,
      backgroundColor: "transparent",
      grid: { top: 16, right: 16, bottom: 32, left: 52 },
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
          const color = riskColor(score);
          return `<div style="font-size:10px;color:${DS.mute}">${formatTs(p.value[0])}</div>
                  <span style="color:${color};font-weight:600">${score != null ? score.toFixed(1) : "—"}</span>`;
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
        max: 100,
        interval: 25,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: DS.hairline, type: "dashed" } },
        axisLabel: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: DS.mute,
        },
      },
      series: [
        {
          type: "line",
          data: timestamps.map((t, i) => [t, scores[i]]),
          smooth: 0.3,
          symbol: "none",
          lineStyle: { width: 2, color: DS.signalTeal },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(30,138,138,0.15)" },
                { offset: 1, color: "rgba(30,138,138,0.01)" },
              ],
            },
          },
          connectNulls: false,
          markArea: { data: markAreaData, silent: true },
          markLine:
            markLineData.length
              ? { data: markLineData, silent: true, symbol: ["none", "none"] }
              : undefined,
        },
      ],
    };
  }, [records, selectedTimestamp]);

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
        No risk records available
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
