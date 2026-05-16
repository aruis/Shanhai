import type { CSSProperties } from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';

interface ControlsProps {
  scenarios: Array<{ id: string; label: string }>;
  scenario: string;
  running: boolean;
  speed: number;
  paramPresets: Array<{ id: string; label: string }>;
  paramPreset: string;
  onScenarioChange: (scenario: string) => void;
  onParamPresetChange: (preset: string) => void;
  onToggleRunning: () => void;
  onStep: () => void;
  onSpeedChange: (speed: number) => void;
}

export function Controls({
  scenarios,
  scenario,
  running,
  speed,
  paramPresets,
  paramPreset,
  onScenarioChange,
  onParamPresetChange,
  onToggleRunning,
  onStep,
  onSpeedChange,
}: ControlsProps) {
  return (
    <section style={panelStyle}>
      <div style={panelTitleStyle}>Simulation</div>
      <label style={labelStyle}>
        Scenario
        <select
          value={scenario}
          onChange={(event) => onScenarioChange(event.target.value)}
          style={selectStyle}
        >
          {scenarios.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        Param preset
        <select
          value={paramPreset}
          onChange={(event) => onParamPresetChange(event.target.value)}
          style={selectStyle}
        >
          {paramPresets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div style={buttonRowStyle}>
        <button type="button" onClick={onToggleRunning} style={primaryButtonStyle}>
          {running ? <Pause size={15} /> : <Play size={15} />}
          {running ? 'Pause' : 'Run'}
        </button>
        <button type="button" onClick={onStep} style={buttonStyle}>
          <SkipForward size={15} />
          Step
        </button>
      </div>

      <label style={labelStyle}>
        Speed
        <div style={rangeRowStyle}>
          <input
            type="range"
            min="1"
            max="60"
            step="1"
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
            style={rangeStyle}
          />
          <span style={valuePillStyle}>{speed.toFixed(0)} t/s</span>
        </div>
      </label>
    </section>
  );
}

const panelStyle = {
  display: 'grid',
  gap: 12,
  padding: 14,
  border: '1px solid #202a35',
  background: '#10161d',
} satisfies CSSProperties;

const panelTitleStyle = {
  color: '#f2f6fa',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: 6,
  color: '#8ea0b3',
  fontSize: 12,
} satisfies CSSProperties;

const selectStyle = {
  width: '100%',
  minHeight: 34,
  color: '#e6edf3',
  border: '1px solid #2b3948',
  borderRadius: 4,
  background: '#0c1218',
  padding: '0 10px',
} satisfies CSSProperties;

const buttonRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
} satisfies CSSProperties;

const buttonStyle = {
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  color: '#dbe7f3',
  border: '1px solid #2b3948',
  borderRadius: 4,
  background: '#151d26',
  cursor: 'pointer',
} satisfies CSSProperties;

const primaryButtonStyle = {
  ...buttonStyle,
  border: '1px solid #2f638f',
  background: '#16324a',
} satisfies CSSProperties;

const rangeRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 56px',
  gap: 8,
  alignItems: 'center',
} satisfies CSSProperties;

const rangeStyle = {
  width: '100%',
  accentColor: '#58a6ff',
} satisfies CSSProperties;

const valuePillStyle = {
  display: 'inline-flex',
  minHeight: 26,
  alignItems: 'center',
  justifyContent: 'center',
  color: '#c9d7e4',
  border: '1px solid #263544',
  borderRadius: 4,
  background: '#0c1218',
  fontVariantNumeric: 'tabular-nums',
} satisfies CSSProperties;
