export function formatValue(value, options = {}) {
  if (value === null) return "Null";
  if (value === undefined) return "Not available";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") {
    const maximumFractionDigits = options.maximumFractionDigits ?? (Math.abs(value) >= 100 ? 2 : 4);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Empty";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function formatUnit(unit) {
  return unit === null ? "Unit unavailable" : unit || "Unit unavailable";
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return "Not available";
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return timestamp;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatPercent(value) {
  if (value === null) return "Null";
  if (value === undefined) return "Not available";
  if (typeof value !== "number") return String(value);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

export function titleize(value) {
  if (!value) return "Not available";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function latest(records = []) {
  return records.length ? records[records.length - 1] : null;
}

export function measurementRows(record) {
  const signalFeatures = record?.signal_features || {};
  return Object.entries(signalFeatures).map(([name, details]) => ({
    id: name,
    name: titleize(name),
    value: details?.current_value,
    unit: null,
    unit_status: "UNKNOWN",
    quality: record?.state_features?.[`${name}_signal_missing`] === 1 ? "MISSING" : record?.telemetry_status,
    source: "M0.4 feature artifact",
  }));
}

export function modelDisplayName(name) {
  const names = {
    anomaly_isolation_forest: "Isolation Forest",
    behavioral_cluster: "K-Means behavioral state",
    temporal_baseline: "Temporal baseline",
  };
  return names[name] || titleize(name);
}

export function modelGroup(records = []) {
  return records.reduce((groups, record) => {
    groups[record.model_name] = record;
    return groups;
  }, {});
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
