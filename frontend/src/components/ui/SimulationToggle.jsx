import Toggle from "./Toggle.jsx";

export default function SimulationToggle({ value, onChange }) {
  return (
    <Toggle
      label="Data mode"
      value={value}
      onChange={onChange}
      options={[
        { value: "replay", label: "Replay" },
        { value: "live", label: "Live" },
      ]}
    />
  );
}
