/**
 * ContributionBars — ECharts horizontal bar chart showing M0.5/M0.6
 * layer contributions to the M0.8 risk fusion score.
 *
 * Props:
 *   analyticalEvidence  — risk.analytical_evidence object from API
 *   height              — number (px), default 120
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
  hairlineStrong: "#C7D1CD",
};

function layerColor(score) {
  if (score == null) return DS.mute;
  if (score >= 70) return DS.rust;
  if (score >= 40) return DS.brass;
  return DS.moss;
}

export default function ContributionBars({ analyticalEvidence = {}, height = 120 }) {
  const option = useMemo(() => {
    const m05 = analyticalEvidence?.m05;
    const m06 = analyticalEvidence?.m06;

    const layers = [];
    if (m05) {
      layers.push({
        name: "M0.5 Intelligence",
        score: m05.score ?? null,
        available: m05.available,
      });
    }
    if (m06) {
      layers.push({
        name: "M0.6 Models",
        score: m06.score ?? null,
        available: m06.available,
      });
    }

    if (!layers.length) return null;

    const names = layers.map((l) => l.name);
    const values = layers.map((l) => l.score ?? 0);
    const colors = layers.map((l) => layerColor(l.score));

    return {
      animation: true,
      animationDuration: 420,
      animationEasing: "cubicOut",
      backgroundColor: "transparent",
      grid: { top: 8, right: 40, bottom: 8, left: 120, containLabel: false },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#fff",
        borderColor: DS.hairline,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: DS.ink },
        formatter: (params) => {
          const p = params[0];
          if (!p) return "";
          const score = p.value;
          const color = layerColor(score);
          return `<div style="font-size:10px;color:${DS.mute}">${p.name}</div>
                  <span style="color:${color};font-weight:600">${score != null ? score.toFixed(1) : "—"}</span>`;
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: DS.hairline, type: "dashed" } },
        axisLabel: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: DS.mute,
        },
      },
      yAxis: {
        type: "category",
        data: names,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          color: DS.body,
        },
      },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] },
          })),
          barMaxWidth: 20,
          label: {
            show: true,
            position: "right",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: DS.body,
            formatter: (p) => p.value != null ? p.value.toFixed(1) : "—",
          },
        },
      ],
    };
  }, [analyticalEvidence]);

  if (!option) {
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
        No contribution data available
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
