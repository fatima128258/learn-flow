import React from 'react';

export interface LineChartDatum {
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartDatum[];
  className?: string;
  height?: number;
  color?: string;
  showArea?: boolean;
}

/**
 * Dependency-free line/area chart rendered with SVG.
 * Displays smooth curves with optional filled area beneath.
 */
export const LineChart: React.FC<LineChartProps> = ({
  data,
  className = '',
  height = 240,
  color = '#10b981', // success-500 green
  showArea = true,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-neutral-400" style={{ height }}>
        No data available
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const width = 700; // Fixed width, responsive via viewBox
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = 0;
  const valueRange = maxValue - minValue;

  // Calculate points
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.value - minValue) / (valueRange || 1)) * chartHeight;
    return { x, y, ...d };
  });

  // Create smooth curve path using quadratic bezier curves
  const createSmoothPath = (pts: typeof points): string => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;

    let path = `M ${pts[0].x},${pts[0].y}`;

    for (let i = 0; i < pts.length - 1; i++) {
      const current = pts[i];
      const next = pts[i + 1];
      const midX = (current.x + next.x) / 2;

      path += ` Q ${current.x},${current.y} ${midX},${(current.y + next.y) / 2}`;
      if (i < pts.length - 2) {
        path += ` T ${next.x},${next.y}`;
      } else {
        path += ` Q ${next.x},${next.y} ${next.x},${next.y}`;
      }
    }

    return path;
  };

  const linePath = createSmoothPath(points);

  // Create area path (same as line but closes to bottom)
  const areaPath = showArea && points.length > 0
    ? `${linePath} L ${points[points.length - 1].x},${padding.top + chartHeight} L ${points[0].x},${padding.top + chartHeight} Z`
    : '';

  // Y-axis labels (show ~5 ticks)
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const value = maxValue - (i / (yTicks - 1)) * (maxValue - minValue);
    return {
      value: Math.round(value),
      y: padding.top + (i / (yTicks - 1)) * chartHeight,
    };
  });

  // X-axis labels (show every nth label to avoid crowding)
  const xLabelInterval = Math.ceil(data.length / 8);
  const xLabels = data.filter((_, i) => i % xLabelInterval === 0 || i === data.length - 1);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxWidth: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {yLabels.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={padding.left + chartWidth}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((tick, i) => (
          <text
            key={i}
            x={padding.left - 10}
            y={tick.y}
            textAnchor="end"
            alignmentBaseline="middle"
            className="text-xs fill-neutral-500"
            style={{ fontSize: '12px' }}
          >
            {tick.value}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((d, i) => {
          const index = data.indexOf(d);
          const x = padding.left + (index / (data.length - 1 || 1)) * chartWidth;
          return (
            <text
              key={i}
              x={x}
              y={height - padding.bottom + 25}
              textAnchor="middle"
              className="text-xs fill-neutral-500"
              style={{ fontSize: '11px' }}
            >
              {d.label}
            </text>
          );
        })}

        {/* Area fill */}
        {showArea && areaPath && (
          <path
            d={areaPath}
            fill={color}
            fillOpacity="0.1"
          />
        )}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="white"
              stroke={color}
              strokeWidth="2"
            />
            <title>{`${point.label}: ${point.value}`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
};

LineChart.displayName = 'LineChart';
