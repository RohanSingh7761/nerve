import React from 'react';
import { EdgeProps, getBezierPath } from '@xyflow/react';
import { useNerveStore } from '../../state/store';
import { MESSAGE_KIND_COLORS } from '../../motion/tokens';
import { AgentName } from '../../types/events';

export const MessageEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  target,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const pathId = `edge-path-${id}`;
  const isDashed = (data as { dashed?: boolean } | undefined)?.dashed ?? false;
  const edgeLabel = (data as { label?: string } | undefined)?.label;

  const safeLabelX = Number.isFinite(labelX) ? labelX : 0;
  const safeLabelY = Number.isFinite(labelY) ? labelY : 0;

  // Check if there are active particles travelling along this edge
  const particles = useNerveStore((state) => state.particles);
  const activeParticles = particles.filter(
    (p) => p.from === (source as AgentName) && p.to === (target as AgentName)
  );

  const hasActivePulse = activeParticles.length > 0;
  const primaryParticle = activeParticles[0];
  const pulseColor = primaryParticle
    ? MESSAGE_KIND_COLORS[primaryParticle.kind] || '#4F46E5'
    : '#4F46E5';

  return (
    <>
      {/* Background glow stroke if active */}
      {hasActivePulse && (
        <path
          d={edgePath}
          fill="none"
          stroke={pulseColor}
          strokeWidth={4}
          strokeOpacity={0.25}
          style={{ filter: 'blur(3px)' }}
          className="transition-all duration-300"
        />
      )}

      {/* Main axon edge path */}
      <path
        id={pathId}
        d={edgePath}
        fill="none"
        stroke={hasActivePulse ? pulseColor : '#CBD5E1'}
        strokeWidth={hasActivePulse ? 2.5 : 1.5}
        strokeDasharray={isDashed ? '4,4' : undefined}
        className="transition-colors duration-300"
      />

      {/* Edge label for loop / challenge if idle */}
      {edgeLabel && !hasActivePulse && (
        <g transform={`translate(${safeLabelX}, ${safeLabelY})`}>
          <rect
            x={-24}
            y={-9}
            width={48}
            height={18}
            rx={9}
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth={1}
            className="shadow-xs"
          />
          <text
            x={0}
            y={3}
            textAnchor="middle"
            fill="#64748B"
            fontSize={9}
            fontFamily="var(--font-mono)"
            className="select-none pointer-events-none font-medium"
          >
            {edgeLabel}
          </text>
        </g>
      )}

      {/* Animated traveling particles */}
      {activeParticles.map((p) => {
        const durSec = `${(p.durationMs / 1000).toFixed(2)}s`;
        const color = MESSAGE_KIND_COLORS[p.kind] || '#4F46E5';

        return (
          <g key={p.id}>
            {/* Outer halo */}
            <circle r={6} fill={color} opacity={0.3} style={{ filter: 'blur(2px)' }}>
              <animateMotion
                dur={durSec}
                repeatCount="1"
                fill="freeze"
                path={edgePath}
              />
            </circle>

            {/* Core spark */}
            <circle r={3.5} fill={color}>
              <animateMotion
                dur={durSec}
                repeatCount="1"
                fill="freeze"
                path={edgePath}
              />
            </circle>

            {/* Floating summary chip near mid-flight */}
            <g transform={`translate(${safeLabelX}, ${safeLabelY - 14})`}>
              <rect
                x={-Math.min(100, (p.summary.length * 4) + 12)}
                y={-12}
                width={Math.min(200, (p.summary.length * 8) + 24)}
                height={22}
                rx={11}
                fill="#FFFFFF"
                stroke={color}
                strokeWidth={1.5}
                className="shadow-md"
              />
              <text
                x={0}
                y={3}
                textAnchor="middle"
                fill="#0F172A"
                fontSize={10}
                fontWeight={600}
                fontFamily="var(--font-body)"
                className="select-none pointer-events-none"
              >
                {p.summary.length > 28 ? `${p.summary.slice(0, 26)}...` : p.summary}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
};
