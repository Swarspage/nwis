/**
 * ModelFeatureChart — ECharts horizontal bar chart showing feature
 * contribution magnitudes from M0.6 model evidence.
 *
 * Props:
 *   records  — array of model records at current timestamp
 *   height   — number (px), default 180
 */
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { modelDisplayName, safeArray, titleize } from "../../utils/format.js";

const DS = {
  signalTeal: "#1E8A8A",
  brass: "#C77A2E",
  strataSlate: "#5C7A99",
  strataTan: "#C9A87C",
  moss: "#2F6F4E",
  mute: "#8C99A6",
  hairline: "#DFE6E3",
  ink: "#0A2540",
  body: "#5B6B7A",
};

const MODEL_COLORS = [DS.signalTeal, DS.brass, DS.strataSlate, DS.strataTan, DS.moss];

function directionColor(direction, defaultColor) {
  if (direction === "increasing" || direction === "high") return DS.brass;
  if (direction === "decreasing" || direction === "low") return DS.moss;
  return defaultColor;
}

export default function ModelFeatureChart({ records = [], height = 180 }) {
  const option = useMemo(() => {
    if (!records.length) return null;

    // Flatten evidence from all models, labelled by model
    const allEvidence = [];
    records.forEach((rec, modelIdx) => {
      const items = safeArray(rec.evidence);
      items.forEach((item) => {
        if (item.contribution != null && item.feature) {
          allEvidence.push({
            label: `${modelDisplayName(rec.model_name)}: ${titleize(item.feature)}`,
            value: Math.abs(item.contribution),
            direction: item.direction,
            modelColor: MODEL_COLORS[modelIdx % MODEL_COLORS.length],
          });
        }
      });
    });

    if (!allEvidence.length) return null;

    // Sort by magnitude descending, cap at top 10
    allEvidence.sort((a, b) => b.value - a.value);
    const top = allEvidence.slice(0, 10);

    const names = top.map((e) => e.label);
    const values = top.map((e) => e.value);

    return {
      animation: true,
      animationDuration: 420,
      animationEasing: "cubicOut",
      backgroundColor: "transparent",
      grid: { top: 8, right: 56, bottom: 8, left: 8, containLabel: true },
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
          return `<div style="font-size:10px;color:${DS.mute}">${p.name}</div>
                  <b>${typeof p.value === "number" ? p.value.toFixed(3) : "—"}</b>`;
        },
      },
      xAxis: {
        type: "value",
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
      yAxis: {
        type: "category",
        data: names,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontFamily: "'Inter', sans-serif",
          fontSize: 10,
          color: DS.body,
          width: 160,
          overflow: "truncate",
        },
      },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: directionColor(top[i].direction, top[i].modelColor),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barMaxWidth: 14,
          label: {
            show: true,
            position: "right",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: DS.mute,
            formatter: (p) => typeof p.value === "number" ? p.value.toFixed(2) : "—",
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
        No feature evidence available
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
