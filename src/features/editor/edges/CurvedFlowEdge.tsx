import { memo } from 'react';
import { getBezierPath, type EdgeProps } from 'reactflow';

export interface CurvedFlowEdgeData {
  laneOffset: number;
  curvature: number;
  animationTick?: number;
  animationDurationMs?: number;
}

const getPerpendicularOffset = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  laneOffset: number
): { x: number; y: number } => {
  if (laneOffset === 0) {
    return { x: 0, y: 0 };
  }

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy);

  if (length < 0.0001) {
    return { x: 0, y: 0 };
  }

  const normalX = -dy / length;
  const normalY = dx / length;

  return {
    x: normalX * laneOffset,
    y: normalY * laneOffset
  };
};

export const CurvedFlowEdge = memo((props: EdgeProps<CurvedFlowEdgeData>) => {
  const laneOffset = props.data?.laneOffset ?? 0;
  const curvature = props.data?.curvature ?? 0.35;
  const animationTick = props.data?.animationTick ?? 0;
  const animationDurationMs = props.data?.animationDurationMs ?? 2000;
  const offset = getPerpendicularOffset(props.sourceX, props.sourceY, props.targetX, props.targetY, laneOffset);

  const [edgePath] = getBezierPath({
    sourceX: props.sourceX + offset.x,
    sourceY: props.sourceY + offset.y,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX + offset.x,
    targetY: props.targetY + offset.y,
    targetPosition: props.targetPosition,
    curvature
  });

  const stroke = typeof props.style?.stroke === 'string' ? props.style.stroke : '#94a3b8';
  const strokeWidth = typeof props.style?.strokeWidth === 'number' ? props.style.strokeWidth : 2;
  const filter = typeof props.style?.filter === 'string' ? props.style.filter : undefined;

  return (
    <g>
      <path
        id={props.id}
        d={edgePath}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        style={{
          fill: 'none',
          stroke,
          strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          filter,
          pointerEvents: 'none'
        }}
      />

      {props.animated ? (
        <path
          key={`${props.id}-${animationTick}`}
          d={edgePath}
          pathLength={1}
          style={{
            fill: 'none',
            stroke,
            strokeWidth,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeDasharray: 1,
            strokeDashoffset: 1,
            animation: `edge-flow-fill ${animationDurationMs}ms linear forwards`,
            filter,
            pointerEvents: 'none'
          }}
        />
      ) : null}

      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={props.interactionWidth ?? 24}
        className="react-flow__edge-interaction"
      />
    </g>
  );
});

CurvedFlowEdge.displayName = 'CurvedFlowEdge';
