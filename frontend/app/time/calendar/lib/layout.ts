import { MINUTES_PER_DAY } from './week';

export interface CalendarEventLike {
  startAt: string;
  endAt: string;
}

export interface PositionedEvent<T extends CalendarEventLike> {
  event: T;
  /** Zero-based column inside the event's cluster. */
  lane: number;
  /** Total columns in the cluster; 1 when nothing overlaps. */
  laneCount: number;
  topPercent: number;
  heightPercent: number;
}

interface ClippedEvent<T> {
  event: T;
  start: number;
  end: number;
}

function clipToDay<T extends CalendarEventLike>(
  event: T,
  dayStartMs: number
): ClippedEvent<T> | null {
  const MS_PER_MINUTE = 60_000;
  const start =
    (new Date(event.startAt).getTime() - dayStartMs) / MS_PER_MINUTE;
  const end = (new Date(event.endAt).getTime() - dayStartMs) / MS_PER_MINUTE;

  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  const clippedStart = Math.max(0, Math.min(MINUTES_PER_DAY, start));
  const clippedEnd = Math.max(0, Math.min(MINUTES_PER_DAY, end));

  // Events fully outside this day, or with no visible slice, are skipped.
  if (clippedEnd <= clippedStart) return null;

  return { event, start: clippedStart, end: clippedEnd };
}

/**
 * Positions one day's events on the 24h grid and splits overlapping events
 * into side-by-side lanes.
 *
 * Algorithm: events are sorted by start, grouped into clusters that chain by
 * overlap, then each event takes the lowest lane whose previous event has
 * already ended. Every event in a cluster shares the cluster's lane count so
 * the blocks tile evenly.
 */
export function layoutDayEvents<T extends CalendarEventLike>(
  events: T[],
  day: Date
): PositionedEvent<T>[] {
  const dayStartMs = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    0,
    0,
    0
  ).getTime();

  const clipped = events
    .map((event) => clipToDay(event, dayStartMs))
    .filter((item): item is ClippedEvent<T> => item !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const positioned: PositionedEvent<T>[] = [];
  let cluster: ClippedEvent<T>[] = [];
  let clusterEnd = -1;

  const flushCluster = () => {
    if (cluster.length === 0) return;

    const laneEnds: number[] = [];
    const assigned: { item: ClippedEvent<T>; lane: number }[] = [];

    for (const item of cluster) {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start);
      if (lane === -1) {
        laneEnds.push(item.end);
        lane = laneEnds.length - 1;
      } else {
        laneEnds[lane] = item.end;
      }
      assigned.push({ item, lane });
    }

    const laneCount = laneEnds.length;
    for (const { item, lane } of assigned) {
      positioned.push({
        event: item.event,
        lane,
        laneCount,
        topPercent: (item.start / MINUTES_PER_DAY) * 100,
        heightPercent: ((item.end - item.start) / MINUTES_PER_DAY) * 100,
      });
    }

    cluster = [];
    clusterEnd = -1;
  };

  for (const item of clipped) {
    if (cluster.length > 0 && item.start >= clusterEnd) {
      flushCluster();
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flushCluster();

  return positioned;
}
