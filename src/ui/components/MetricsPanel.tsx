import type { CSSProperties } from 'react';

interface MetricItem {
  label: string;
  value: string;
}

interface MetricsPanelProps {
  metrics: MetricItem[];
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section style={panelStyle}>
      <div style={panelTitleStyle}>Metrics</div>
      <div style={metricsGridStyle}>
        {metrics.map((metric) => (
          <div key={metric.label} style={metricStyle}>
            <span style={metricLabelStyle}>{metric.label}</span>
            <strong style={metricValueStyle}>{metric.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

const panelStyle = {
  padding: 14,
  border: '1px solid #202a35',
  background: '#10161d',
} satisfies CSSProperties;

const panelTitleStyle = {
  marginBottom: 12,
  color: '#f2f6fa',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties;

const metricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(110px, 1fr))',
  gap: 8,
} satisfies CSSProperties;

const metricStyle = {
  minHeight: 54,
  display: 'grid',
  alignContent: 'center',
  gap: 4,
  border: '1px solid #263544',
  borderRadius: 4,
  background: '#0c1218',
  padding: '8px 10px',
} satisfies CSSProperties;

const metricLabelStyle = {
  color: '#8293a6',
  fontSize: 11,
} satisfies CSSProperties;

const metricValueStyle = {
  color: '#f2f6fa',
  fontSize: 17,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
} satisfies CSSProperties;
