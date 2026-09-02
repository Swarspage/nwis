/**
 * TelemetryChart — ECharts multi-series time-series chart.
 *
 * Props:
 *   records   — array of API telemetry records
 *   fields    — array of { key, label, color? } to render
 *   title     — string
 *   height    — number (px), default 280
 *   compact   — boolean, reduces axis labels for tight layouts
 */
import { useMemo, useRef, useCallback } from "react";
import ReactECharts from "echarts-for-react";

// Design-system palette (must match tokens.css)
const DS = {
  signalTeal: "#1E8A8A",
  ink: "#0A2540",
  slate: "#3E5164",
  body: "#5B6B7A",
  mute: "#8C99A6",
  hairline: "#DFE6E3",
  canvas: "#F5F7F6",
  brass: "#C77A2E",
  rust: "#B3261E",
  moss: "#2F6F4E",
  strataTan: "#C9A87C",
  strataSlate: "#5C7A99",
};

const SERIES_COLORS = [
  DS.signalTeal,
  DS.brass,
  DS.strataSlate,
  DS.strataTan,
  DS.moss,
  DS.slate,
];

function formatTs(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return isoStr;
  }
}

function extractSeries(records, fields) {
  return fields.map((f, idx) => {
    const data = records.map((r) => {
      const ts = r.timestamp;
      const val =
        r.signal_features?.[f.key]?.current_value ??
        r.measurements?.[f.key]?.value ??
        null;
      return [ts, val];
    });

    return {
      name: f.label,
      type: "line",
      yAxisIndex: idx,
      data,
      smooth: true,
      symbol: "none",
      lineStyle: {
        width: 1.5,
        color: f.color || SERIES_COLORS[idx % SERIES_COLORS.length],
      },
      itemStyle: {
        color: f.color || SERIES_COLORS[idx % SERIES_COLORS.length],
      },
      connectNulls: false,
      emphasis: { focus: "series" },
    };
  });
}

export default function TelemetryChart({
  records = [],
  fields = [],
  title = "",
  height = 280,
  compact = false,
}) {
  const chartRef = useRef(null);

  const option = useMemo(() => {
    if (!records.length || !fields.length) return null;

    const timestamps = records.map((r) => r.timestamp);
    const series = extractSeries(records, fields);
    const legendData = fields.map((f) => f.label);

    return {
      animation: true,
      animationDuration: 300,
      animationEasing: "quadraticOut",
      backgroundColor: "transparent",
      textStyle: {
        fontFamily: "'IBM Plex Mono', monospace",
        color: DS.body,
        fontSize: 11,
      },
      title: title
        ? {
            text: title,
            textStyle: {
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: DS.slate,
            },
            top: 4,
            left: 4,
          }
        : undefined,
      grid: {
        top: title ? 40 : 20,
        right: 16,
        bottom: compact ? 28 : 36,
        left: 60,
        containLabel: false,
      },
      legend:
        fields.length > 1
          ? {
              data: legendData,
              top: 4,
              right: 16,
              itemWidth: 12,
              itemHeight: 2,
              textStyle: {
                fontFamily: "'Inter', sans-serif",
                fontSize: 11,
                color: DS.body,
              },
            }
          : undefined,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: DS.hairline, width: 1 } },
        backgroundColor: "#fff",
        borderColor: DS.hairline,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: DS.ink,
        },
        formatter: (params) => {
          if (!params.length) return "";
          const ts = formatTs(params[0].axisValue);
          const lines = params
            .filter((p) => p.value?.[1] != null)
            .map(
              (p) =>
                `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle;"></span>${p.seriesName}: <b>${
                  typeof p.value[1] === "number" ? p.value[1].toFixed(2) : "—"
                }</b>`
            );
          return `<div style="font-size:10px;color:${DS.mute};margin-bottom:4px;">${ts}</div>${lines.join("<br/>")}`;
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
          interval: compact ? "auto" : Math.max(0, Math.floor(timestamps.length / 6) - 1),
          rotate: compact ? 30 : 0,
        },
        splitLine: { show: false },
      },
      yAxis: fields.map((f, idx) => ({
        type: "value",
        scale: true,
        show: idx === 0,
        splitLine: idx === 0 ? { lineStyle: { color: DS.hairline, type: "dashed", width: 1 } } : { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: DS.mute,
          formatter: (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${typeof v === "number" ? v.toFixed(1) : v}`),
        },
      })),
      series,
    };
  }, [records, fields, title, compact]);

  if (!records.length || !fields.length || !option) {
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
        No telemetry data available
      </div>
    );
  }

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge={false}
      lazyUpdate={true}
    />
  );
}
