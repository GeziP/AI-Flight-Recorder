'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PlaybackControls } from './playback-controls';

interface TerminalPlayerProps {
  terminalLog: string;
  sessionDuration: number;
  eventMarkers: { position: number; type: string }[];
}

export function TerminalPlayer({
  terminalLog,
  sessionDuration,
  eventMarkers,
}: TerminalPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);

  const rafRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number | null>(null);

  // Split into lines for line-based playback
  const lines = useMemo(() => terminalLog.split('\n').filter(Boolean), [terminalLog]);
  const totalLines = lines.length;

  // Map time to line index
  const lineIndex = sessionDuration > 0
    ? Math.min(Math.floor((currentTime / sessionDuration) * totalLines), totalLines)
    : 0;
  const output = lines.slice(0, lineIndex).join('\n');

  // Animation loop
  const tick = useCallback(
    (timestamp: number) => {
      if (prevTimeRef.current === null) {
        prevTimeRef.current = timestamp;
      }
      const delta = timestamp - prevTimeRef.current;
      prevTimeRef.current = timestamp;

      setCurrentTime((prev) => {
        const next = prev + delta * speed;
        if (next >= sessionDuration) {
          setIsPlaying(false);
          return sessionDuration;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    },
    [speed, sessionDuration],
  );

  useEffect(() => {
    if (isPlaying) {
      prevTimeRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      prevTimeRef.current = null;
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, tick]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && currentTime >= sessionDuration) {
        setCurrentTime(0);
      }
      return !prev;
    });
  }, [currentTime, sessionDuration]);

  const handleSeek = useCallback((position: number) => {
    setCurrentTime(position);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  const terminalRef = useRef<HTMLPreElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Terminal area */}
      <div
        className="flex-1 overflow-auto p-4"
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {output.length > 0 || isPlaying ? (
          <pre
            ref={terminalRef}
            className="font-mono text-[12px] leading-[1.6] whitespace-pre-wrap break-words text-[#e0e0e0] m-0"
          >
            {output}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-[#555] text-[13px]">
            (press play to start replay)
          </div>
        )}
      </div>

      {/* Playback controls */}
      <PlaybackControls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        currentTime={currentTime}
        totalDuration={sessionDuration}
        onSeek={handleSeek}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        eventMarkers={eventMarkers}
      />
    </div>
  );
}
