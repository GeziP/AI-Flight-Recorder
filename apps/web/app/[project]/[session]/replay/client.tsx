'use client';

import { TerminalPlayer } from '@/components/replay/terminal-player';

export default function ReplayClient(props: {
  terminalLog: string;
  sessionDuration: number;
  eventMarkers: { position: number; type: string }[];
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TerminalPlayer {...props} />
    </div>
  );
}
