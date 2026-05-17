import type { CSSProperties } from 'react';

interface MetricItem {
  label: string;
  value: string;
}

interface MetricHistoryPoint {
  tick: number;
  totalWater: number | null;
  avgMoisture?: number | null;
  avgNutrient?: number | null;
  riverCells: number | null;
  lakeCells: number | null;
  herbCells?: number | null;
  herbBiomass?: number | null;
  grassCoverage?: number | null;
  woodyCells?: number | null;
  woodyBiomass?: number | null;
  woodyCoverage?: number | null;
  animalCount?: number | null;
  meanAnimalEnergy?: number | null;
  animalBirths?: number | null;
  animalDeaths?: number | null;
  juvenileAnimalCount?: number | null;
  reproductiveAnimalCount?: number | null;
  shelteredAnimalCount?: number | null;
  largestAnimalPocketPopulation?: number | null;
  secondAnimalPocketPopulation?: number | null;
}

interface MetricsPanelProps {
  metrics: MetricItem[];
  history: MetricHistoryPoint[];
}

const seriesConfig = [
  { key: 'totalWater', label: 'Water', color: '#58a6ff' },
  { key: 'avgMoisture', label: 'Mean moisture', color: '#5fb6d6' },
  { key: 'avgNutrient', label: 'Mean nutrient', color: '#dcb455' },
  { key: 'grassCoverage', label: 'Grass coverage', color: '#72d86b' },
  { key: 'woodyCoverage', label: 'Woody coverage', color: '#b8964f' },
  { key: 'animalCount', label: 'Animals', color: '#f2c75c' },
  { key: 'meanAnimalEnergy', label: 'Energy', color: '#e9785f' },
  { key: 'reproductiveAnimalCount', label: 'Reproductive', color: '#d78fff' },
  { key: 'shelteredAnimalCount', label: 'Sheltered', color: '#8ecf8a' },
  { key: 'largestAnimalPocketPopulation', label: 'Largest pocket', color: '#f09a5a' },
  { key: 'secondAnimalPocketPopulation', label: 'Second pocket', color: '#8bb8ff' },
] satisfies Array<{
  key: keyof MetricHistoryPoint;
  label: string;
  color: string;
}>;

export function MetricsPanel({ metrics, history }: MetricsPanelProps) {
  const chart = buildChart(history);

  return (
    <section style={panelStyle}>
      <div style={headerRowStyle}>
        <div style={panelTitleStyle}>Metrics</div>
        <div style={legendStyle}>
          {seriesConfig.map((series) => (
            <span key={series.key} style={legendItemStyle}>
              <span style={legendSwatchStyle(series.color)} />
              {series.label}
            </span>
          ))}
        </div>
      </div>
      <div style={contentStyle}>
        <div style={chartShellStyle}>
          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            preserveAspectRatio="none"
            style={chartStyle}
            role="img"
            aria-label="Eco-CA multi-season metric history"
          >
            <path d={chart.gridPath} stroke="#1d2a36" strokeWidth="1" />
            {seriesConfig.map((series) => (
              <path
                key={series.key}
                d={chart.paths[series.key]}
                fill="none"
                stroke={series.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
        <div style={metricsGridStyle}>
          {metrics.map((metric) => (
            <div key={metric.label} style={metricStyle}>
              <span style={metricLabelStyle}>{metric.label}</span>
              <strong style={metricValueStyle}>{metric.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const buildChart = (history: MetricHistoryPoint[]) => {
  const width = 640;
  const height = 92;
  const padding = { top: 8, right: 8, bottom: 12, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const recent = history.slice(-720);

  const paths = Object.fromEntries(
    seriesConfig.map((series) => {
      const values = recent
        .map((item, index) => ({
          index,
          value: item[series.key],
        }))
        .filter(
          (item): item is { index: number; value: number } =>
            typeof item.value === 'number' && Number.isFinite(item.value),
        );

      if (values.length === 0) return [series.key, ''];

      const min = Math.min(...values.map((item) => item.value));
      const max = Math.max(...values.map((item) => item.value));
      const span = max - min || Math.max(1, Math.abs(max));
      const maxIndex = Math.max(1, recent.length - 1);
      const path = values
        .map((item, pointIndex) => {
          const x = padding.left + (item.index / maxIndex) * innerWidth;
          const y =
            padding.top + innerHeight - ((item.value - min) / span) * innerHeight;
          return `${pointIndex === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');

      return [series.key, path];
    }),
  ) as Record<(typeof seriesConfig)[number]['key'], string>;

  const gridPath = [
    `M ${padding.left} ${padding.top} H ${width - padding.right}`,
    `M ${padding.left} ${padding.top + innerHeight / 2} H ${width - padding.right}`,
    `M ${padding.left} ${height - padding.bottom} H ${width - padding.right}`,
  ].join(' ');

  return { width, height, paths, gridPath };
};

const panelStyle = {
  display: 'grid',
  gap: 10,
  padding: 14,
  border: '1px solid #202a35',
  background: '#10161d',
} satisfies CSSProperties;

const headerRowStyle = {
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

const legendStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  color: '#9dafc2',
  fontSize: 11,
} satisfies CSSProperties;

const legendItemStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
} satisfies CSSProperties;

const legendSwatchStyle = (color: string) =>
  ({
    width: 9,
    height: 9,
    borderRadius: 2,
    background: color,
  }) satisfies CSSProperties;

const contentStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.2fr) minmax(420px, 2fr)',
  gap: 12,
  minHeight: 0,
} satisfies CSSProperties;

const chartShellStyle = {
  minWidth: 0,
  minHeight: 108,
  border: '1px solid #263544',
  borderRadius: 4,
  background: '#0c1218',
  padding: 8,
} satisfies CSSProperties;

const chartStyle = {
  width: '100%',
  height: '100%',
  display: 'block',
  overflow: 'visible',
} satisfies CSSProperties;

const metricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(92px, 1fr))',
  gap: 8,
  maxHeight: 132,
  overflowY: 'auto',
  paddingRight: 4,
} satisfies CSSProperties;

const metricStyle = {
  minHeight: 48,
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
  fontSize: 15,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
} satisfies CSSProperties;
