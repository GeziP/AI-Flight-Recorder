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

  // Split into lines, preserving blank lines; strip only trailing empty entry from final \n
  const lines = useMemo(() => {
    const split = terminalLog.split('\n');
    return split.length > 1 && split[split.length - 1] === '' ? split.slice(0, -1) : split;
  }, [terminalLog]);
  const totalLines = lines.length;

  // Map time to line index, memoized to avoid recalc on every frame
  const lineIndex = useMemo(() => {
    return sessionDuration > 0
      ? Math.min(Math.floor((currentTime / sessionDuration) * totalLines), totalLines)
      : 0;
  }, [currentTime, sessionDuration, totalLines]);

  // Fallback: for single-line logs, use char-based progress within the line
  const output = useMemo(() => {
    if (totalLines <= 1) {
      const charIndex = sessionDuration > 0
        ? Math.min(Math.floor((currentTime / sessionDuration) * terminalLog.length), terminalLog.length)
        : 0;
      return terminalLog.slice(0, charIndex);
    }
    return lines.slice(0, lineIndex).join('\n');
  }, [lines, lineIndex, totalLines, terminalLog, currentTime, sessionDuration]);

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

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll: ref on the div with overflow-auto, not on <pre>
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Terminal area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4"
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {output.length > 0 || isPlaying ? (
          <pre
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
