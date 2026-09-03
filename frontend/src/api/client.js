const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const WELL_ID = "WELL-1";

async function request(path, params = {}, options = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = body?.error?.message || body?.detail || response.statusText || "API request failed";
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export const api = {
  health: () => request("/health"),
  wells: () => request("/wells"),
  summary: (wellId = WELL_ID) => request(`/wells/${wellId}/summary`),
  currentRisk: (wellId = WELL_ID) => request(`/wells/${wellId}/risk/current`),
  riskAt: (timestamp, wellId = WELL_ID) => request(`/wells/${wellId}/risk`, { timestamp }),
  riskTimeline: (params = {}, wellId = WELL_ID) => request(`/wells/${wellId}/risk/timeline`, params),
  telemetry: (params = {}, wellId = WELL_ID) => request(`/wells/${wellId}/telemetry`, params),
  intelligence: (params = {}, wellId = WELL_ID) => request(`/wells/${wellId}/intelligence`, params),
  models: (params = {}, wellId = WELL_ID) => request(`/wells/${wellId}/models`, params),
  historicalEvents: (wellId = WELL_ID) => request(`/wells/${wellId}/historical-events`),
  historicalContext: (timestamp, wellId = WELL_ID) => request(`/wells/${wellId}/historical-context`, { timestamp }),
  snapshot: (timestamp, wellId = WELL_ID) => request(`/wells/${wellId}/snapshot`, { timestamp }),
  features: (params = {}, wellId = WELL_ID) => request(`/wells/${wellId}/features`, params),
  
  // Guidance Engine
  currentGuidance: (wellId = WELL_ID) => request(`/wells/${wellId}/guidance/current`),
  guidanceAt: (timestamp, wellId = WELL_ID) => request(`/wells/${wellId}/guidance`, { timestamp }),
  
  // Simulation
  simulationStatus: () => request("/simulation/status"),
  simulationControl: (params) => request("/simulation/control", {}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  })
};

export { WELL_ID };
