'use client';

import { useCallback, useRef } from 'react';

// ---- Time formatting ----

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ---- Event marker colors ----

const MARKER_COLORS: Record<string, string> = {
  prompt: '#6366f1',
  diff: '#f59e0b',
  test: '#22c55e',
  retry: '#8b5cf6',
};

const LEGEND_ITEMS = [
  { type: 'prompt', color: '#6366f1', label: 'Prompt' },
  { type: 'diff', color: '#f59e0b', label: 'Diff' },
  { type: 'test', color: '#22c55e', label: 'Test' },
  { type: 'retry', color: '#8b5cf6', label: 'Retry' },
];

// ---- Props ----

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  totalDuration: number;
  onSeek: (position: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  eventMarkers: { position: number; type: string }[];
}

// ---- Component ----

const SPEEDS = [1, 2, 4, 8, 16, 32, 64, 100];

export function PlaybackControls({
  isPlaying,
  onPlayPause,
  currentTime,
  totalDuration,
  onSeek,
  speed,
  onSpeedChange,
  eventMarkers,
}: PlaybackControlsProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!barRef.current || totalDuration <= 0) return;
      const rect = barRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      onSeek(ratio * totalDuration);
    },
    [onSeek, totalDuration],
  );

  return (
    <div
      className="h-14 border-t border-border flex items-center gap-4 px-4"
      style={{ minHeight: 56 }}
    >
      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: '#171717' }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <polygon points="2,1 13,7 2,13" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div
        ref={barRef}
        className="flex-1 relative cursor-pointer py-2"
        onClick={handleBarClick}
      >
        {/* Track */}
        <div className="h-1 rounded-full" style={{ backgroundColor: '#e5e5e5' }}>
          {/* Fill */}
          <div
            className="h-full rounded-full relative"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: '#171717',
            }}
          >
            {/* Dot at fill end */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
              style={{
                width: 10,
                height: 10,
                backgroundColor: '#171717',
                left: '100%',
              }}
            />
          </div>
        </div>

        {/* Event markers */}
        {eventMarkers.map((marker, i) => {
          const left = totalDuration > 0 ? (marker.position / totalDuration) * 100 : 0;
          const color = MARKER_COLORS[marker.type] ?? '#171717';
          return (
            <div
              key={`${marker.type}-${i}`}
              className="absolute top-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${left}%`,
                width: 6,
                height: 6,
                backgroundColor: color,
                transform: 'translate(-50%, -50%)',
              }}
              title={marker.type}
            />
          );
        })}
      </div>

      {/* Time display */}
      <div
        className="text-[13px] text-text-secondary tabular-nums font-mono shrink-0"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatTime(currentTime)} / {formatTime(totalDuration)}
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-0.5 shrink-0">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-2 py-1 text-[12px] rounded-md font-medium transition-colors ${
              speed === s
                ? 'bg-bg-subtle shadow-sm text-text'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Event legend */}
      <div className="flex items-center gap-3 shrink-0">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.type} className="flex items-center gap-1">
            <div
              className="rounded-full"
              style={{ width: 6, height: 6, backgroundColor: item.color }}
            />
            <span className="text-[11px] text-text-muted">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
