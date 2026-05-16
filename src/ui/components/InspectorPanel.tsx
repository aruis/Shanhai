import type { CSSProperties } from 'react';

interface InspectorPanelProps {
  cell: { x: number; y: number } | null;
  values: Array<{ label: string; value: string }>;
}

export function InspectorPanel({ cell, values }: InspectorPanelProps) {
  return (
    <section style={panelStyle}>
      <div style={titleRowStyle}>
        <div style={panelTitleStyle}>Inspector</div>
        <div style={coordStyle}>{cell ? `${cell.x}, ${cell.y}` : 'No cell'}</div>
      </div>
      {cell ? (
        <div style={valueGridStyle}>
          {values.map((item) => (
            <div key={item.label} style={valueRowStyle}>
              <span style={valueLabelStyle}>{item.label}</span>
              <strong style={valueTextStyle}>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>Click a grid cell to inspect state.</div>
      )}
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

const titleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
} satisfies CSSProperties;

const panelTitleStyle = {
  color: '#f2f6fa',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties;

const coordStyle = {
  color: '#f0c36a',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
} satisfies CSSProperties;

const valueGridStyle = {
  display: 'grid',
  gap: 7,
} satisfies CSSProperties;

const valueRowStyle = {
  display: 'grid',
  gridTemplateColumns: '76px 1fr',
  gap: 8,
  alignItems: 'center',
  minHeight: 28,
  borderBottom: '1px solid #1d2732',
} satisfies CSSProperties;

const valueLabelStyle = {
  color: '#8293a6',
  fontSize: 11,
} satisfies CSSProperties;

const valueTextStyle = {
  overflow: 'hidden',
  color: '#e6edf3',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 600,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties;

const emptyStyle = {
  minHeight: 80,
  display: 'grid',
  placeItems: 'center',
  color: '#728196',
  border: '1px dashed #2a3542',
  borderRadius: 4,
  fontSize: 12,
  textAlign: 'center',
} satisfies CSSProperties;
