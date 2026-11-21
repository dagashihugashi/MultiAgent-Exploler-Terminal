const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** Compact elapsed time for the busy indicator: "42s", "3m5s", "1h12m". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (minutes >= MINUTES_PER_HOUR) {
    return `${Math.floor(minutes / MINUTES_PER_HOUR)}h${minutes % MINUTES_PER_HOUR}m`;
  }
  return minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`;
}
