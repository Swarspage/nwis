/**
 * TelemetryChart — ECharts multi-series time-series chart.
 *
 * Props:
 *   records   — array of API telemetry records
 *   fields    — array of { key, label, color? } to render
 *   title     — string
 *   height    — number (px), default 280
 *   compact   — boolean, reduces axis labels for tight layouts
 *   singleGrid — boolean, forces all series onto a single unified grid
 */
import { useMemo, useRef } from "react";
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

function extractSeries(records, fields, isSingleGrid) {
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
      xAxisIndex: isSingleGrid ? 0 : idx,
      yAxisIndex: isSingleGrid ? 0 : idx,
      data,
      smooth: 0.25,
      symbol: "none",
      lineStyle: {
        width: 1.8,
        color: f.color || SERIES_COLORS[idx % SERIES_COLORS.length],
      },
      itemStyle: {
        color: f.color || SERIES_COLORS[idx % SERIES_COLORS.length],
      },
      connectNulls: true,
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
  singleGrid = false,
}) {
  const chartRef = useRef(null);

  const option = useMemo(() => {
    if (!records.length || !fields.length) return null;

    const timestamps = records.map((r) => r.timestamp);
    const legendData = fields.map((f) => f.label);

    // Only force single grid if explicitly requested or if height is extremely small (< 110px)
    const isSingleGrid = singleGrid || (height < 110 && fields.length > 1);
    const series = extractSeries(records, fields, isSingleGrid);

    if (isSingleGrid) {
      return {
        animation: true,
        animationDuration: 300,
        animationEasing: "quadraticOut",
        backgroundColor: "transparent",
        textStyle: {
          fontFamily: "'IBM Plex Mono', monospace",
          color: DS.body,
          fontSize: 10,
        },
        title: title
          ? {
              text: title,
              textStyle: {
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: DS.slate,
              },
              top: 2,
              left: 4,
            }
          : undefined,
        grid: {
          top: title ? 28 : (fields.length > 1 ? 24 : 14),
          right: 14,
          bottom: 22,
          left: 48,
          containLabel: false,
        },
        legend:
          fields.length > 1
            ? {
                data: legendData,
                top: 2,
                right: 12,
                itemWidth: 10,
                itemHeight: 2,
                textStyle: {
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
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
          padding: [6, 10],
          textStyle: {
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: DS.ink,
          },
          formatter: (params) => {
            if (!params.length) return "";
            const ts = formatTs(params[0].axisValue);
            const lines = params
              .filter((p) => p.value?.[1] != null)
              .map(
                (p) =>
                  `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle;"></span>${p.seriesName}: <b>${
                    typeof p.value[1] === "number" ? p.value[1].toFixed(2) : "—"
                  }</b>`
              );
            return `<div style="font-size:10px;color:${DS.mute};margin-bottom:3px;">${ts}</div>${lines.join("<br/>")}`;
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
            fontSize: 9,
            color: DS.mute,
            interval: "auto",
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          scale: true,
          splitNumber: 3,
          splitLine: { lineStyle: { color: DS.hairline, type: "dashed", width: 1 } },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: DS.mute,
            formatter: (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${typeof v === "number" ? v.toFixed(1) : v}`),
          },
        },
        series,
      };
    }

    // Multi-stacked grid layout — each parameter gets its own auto-scaled sub-grid so subtle deviations are clearly visible!
    const topOffset = title ? 32 : (fields.length > 1 ? 22 : 12);
    const bottomOffset = compact ? 22 : 28;
    const gap = compact ? 6 : 10;
    const totalHeight = height - topOffset - bottomOffset;
    const rowHeight = Math.max(25, (totalHeight - (fields.length - 1) * gap) / fields.length);

    return {
      animation: true,
      animationDuration: 300,
      animationEasing: "quadraticOut",
      backgroundColor: "transparent",
      textStyle: {
        fontFamily: "'IBM Plex Mono', monospace",
        color: DS.body,
        fontSize: 10,
      },
      title: title
        ? {
            text: title,
            textStyle: {
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: DS.slate,
            },
            top: 2,
            left: 4,
          }
        : undefined,
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
      },
      grid: fields.map((f, idx) => ({
        top: Math.round(topOffset + idx * (rowHeight + gap)),
        height: Math.round(rowHeight),
        right: 14,
        left: compact ? 42 : 55,
        containLabel: false,
      })),
      legend:
        fields.length > 1
          ? {
              data: legendData,
              top: 2,
              right: 14,
              itemWidth: 10,
              itemHeight: 2,
              textStyle: {
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
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
        padding: [6, 10],
        textStyle: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: DS.ink,
        },
        formatter: (params) => {
          if (!params.length) return "";
          const ts = formatTs(params[0].axisValue);
          const lines = params
            .filter((p) => p.value?.[1] != null)
            .map(
              (p) =>
                `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle;"></span>${p.seriesName}: <b>${
                  typeof p.value[1] === "number" ? p.value[1].toFixed(2) : "—"
                }</b>`
            );
          return `<div style="font-size:10px;color:${DS.mute};margin-bottom:3px;">${ts}</div>${lines.join("<br/>")}`;
        },
      },
      xAxis: fields.map((f, idx) => ({
        gridIndex: idx,
        type: "category",
        data: timestamps,
        axisLine: { lineStyle: { color: DS.hairline } },
        axisTick: { show: false },
        axisLabel: {
          show: idx === fields.length - 1,
          formatter: formatTs,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          color: DS.mute,
          interval: "auto",
        },
        splitLine: { show: false },
      })),
      yAxis: fields.map((f, idx) => ({
        gridIndex: idx,
        type: "value",
        scale: true,
        splitNumber: compact ? 2 : 3,
        splitLine: { lineStyle: { color: DS.hairline, type: "dashed", width: 1 } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          color: DS.mute,
          formatter: (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${typeof v === "number" ? v.toFixed(1) : v}`),
        },
      })),
      series,
    };
  }, [records, fields, title, height, compact, singleGrid]);

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
          fontSize: 12,
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
      notMerge={true}
      lazyUpdate={true}
    />
  );
}
