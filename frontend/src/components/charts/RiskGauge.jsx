/**
 * RiskGauge — ECharts gauge showing M0.8 risk score.
 * Design system: pill-track, moss → brass → rust three-zone fill.
 * Always paired with data-lg numeric. Never color-only.
 */
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";

const DS = {
  moss: "#2F6F4E",
  brass: "#C77A2E",
  rust: "#B3261E",
  hairlineStrong: "#C7D1CD",
  mute: "#8C99A6",
  ink: "#0A2540",
};

function riskColor(score) {
  if (score == null) return DS.mute;
  if (score >= 70) return DS.rust;
  if (score >= 40) return DS.brass;
  return DS.moss;
}

function riskLabel(score) {
  if (score == null) return "—";
  if (score >= 70) return "ELEVATED";
  if (score >= 40) return "WATCH";
  return "NORMAL";
}

export default function RiskGauge({ score, size = 220 }) {
  const color = riskColor(score);
  const label = riskLabel(score);
  const numericScore = score ?? "—";

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 420,
      animationEasing: "cubicOut",
      backgroundColor: "transparent",
      series: [
        {
          type: "gauge",
          startAngle: 210,
          endAngle: -30,
          min: 0,
          max: 100,
          radius: "88%",
          center: ["50%", "55%"],
          pointer: { show: false },
          progress: {
            show: true,
            width: 10,
            roundCap: true,
            itemStyle: { color },
          },
          axisLine: {
            roundCap: true,
            lineStyle: { width: 10, color: [[1, DS.hairlineStrong]] },
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            show: true,
            offsetCenter: [0, "10%"],
            formatter: score != null ? `{value}` : "—",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: size > 180 ? 28 : 22,
            fontWeight: 500,
            color: DS.ink,
            valueAnimation: true,
          },
          data: [{ value: score ?? 0, name: label }],
          title: {
            show: true,
            offsetCenter: [0, "42%"],
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color,
            formatter: label,
          },
        },
      ],
    }),
    [score, color, label, size]
  );

  return (
    <ReactECharts
      option={option}
      style={{ height: size, width: size }}
      opts={{ renderer: "canvas" }}
      notMerge={false}
    />
  );
}
