import type { CSSProperties } from 'react';
import type { LayerState } from '../../render/PixiViewport';

type WorkbenchLayerState = LayerState & {
  flowArrows?: boolean;
  components?: boolean;
};

interface LayerPanelProps {
  layers: WorkbenchLayerState;
  onChange: (layers: WorkbenchLayerState) => void;
}

const layerLabels: Array<[keyof WorkbenchLayerState, string]> = [
  ['height', 'Height'],
  ['surface', 'Surface'],
  ['water', 'Water'],
  ['flow', 'Flow'],
  ['flowArrows', 'Flow arrows'],
  ['components', 'Components'],
];

export function LayerPanel({ layers, onChange }: LayerPanelProps) {
  return (
    <section style={panelStyle}>
      <div style={panelTitleStyle}>Layers</div>
      <div style={layerGridStyle}>
        {layerLabels.map(([key, label]) => (
          <label key={key} style={toggleStyle}>
            <input
              type="checkbox"
              checked={Boolean(layers[key])}
              onChange={(event) =>
                onChange({ ...layers, [key]: event.target.checked })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
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

const layerGridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
} satisfies CSSProperties;

const toggleStyle = {
  minHeight: 34,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  color: '#c9d7e4',
  border: '1px solid #263544',
  borderRadius: 4,
  background: '#0c1218',
  padding: '0 10px',
  fontSize: 12,
} satisfies CSSProperties;
