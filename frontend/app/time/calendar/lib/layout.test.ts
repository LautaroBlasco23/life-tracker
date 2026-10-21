import { describe, expect, it } from 'vitest';
import { layoutDayEvents } from './layout';

// Dates are local-time so the expectations hold in any test TZ.
const day = new Date(2026, 9, 19);

function isoAt(hours: number, minutes = 0): string {
  return new Date(2026, 9, 19, hours, minutes).toISOString();
}

function event(id: number, startHour: number, endHour: number, minutes = 0) {
  return {
    id,
    startAt: isoAt(startHour),
    endAt: isoAt(endHour, minutes),
  };
}

function byId<T extends { event: { id: number } }>(result: T[], id: number): T {
  const found = result.find((item) => item.event.id === id);
  if (!found) throw new Error(`event ${id} not positioned`);
  return found;
}

describe('layoutDayEvents', () => {
  it('positions a single event on the 24h grid', () => {
    const result = layoutDayEvents([event(1, 10, 12)], day);

    expect(result).toHaveLength(1);
    const positioned = result[0];
    expect(positioned.laneCount).toBe(1);
    expect(positioned.lane).toBe(0);
    expect(positioned.topPercent).toBeCloseTo((600 / 1440) * 100);
    expect(positioned.heightPercent).toBeCloseTo((120 / 1440) * 100);
  });

  it('splits two overlapping events into two lanes', () => {
    const result = layoutDayEvents([event(1, 10, 12), event(2, 11, 13)], day);

    expect(byId(result, 1).laneCount).toBe(2);
    expect(byId(result, 2).laneCount).toBe(2);
    expect(byId(result, 1).lane).not.toBe(byId(result, 2).lane);
  });

  it('keeps non-overlapping events in a single lane', () => {
    const result = layoutDayEvents([event(1, 8, 9), event(2, 9, 10)], day);

    expect(byId(result, 1).laneCount).toBe(1);
    expect(byId(result, 2).laneCount).toBe(1);
  });

  it('reuses a lane once the previous event ends', () => {
    // A long block (09-13) forces two lanes; the 09-10 and 10-11 events are
    // disjoint, so the second one can take the lane the first freed.
    const result = layoutDayEvents(
      [event(1, 9, 13), event(2, 9, 10), event(3, 10, 11)],
      day
    );

    expect(byId(result, 1).laneCount).toBe(2);
    expect(byId(result, 2).laneCount).toBe(2);
    expect(byId(result, 3).laneCount).toBe(2);
    expect(byId(result, 2).lane).toBe(byId(result, 3).lane);
    expect(byId(result, 1).lane).not.toBe(byId(result, 2).lane);
  });

  it('assigns three lanes for a three-deep stack', () => {
    const result = layoutDayEvents(
      [event(1, 9, 12), event(2, 10, 12), event(3, 11, 12)],
      day
    );

    const lanes = new Set(result.map((item) => item.lane));
    expect(lanes.size).toBe(3);
    result.forEach((item) => expect(item.laneCount).toBe(3));
  });

  it('clips an event that crosses midnight into each day', () => {
    const lateNight = {
      id: 1,
      startAt: new Date(2026, 9, 19, 23, 0).toISOString(),
      endAt: new Date(2026, 9, 20, 1, 0).toISOString(),
    };
    const nextDay = new Date(2026, 9, 20);

    const monday = layoutDayEvents([lateNight], day);
    expect(monday).toHaveLength(1);
    expect(monday[0].topPercent).toBeCloseTo((1380 / 1440) * 100);
    expect(monday[0].heightPercent).toBeCloseTo((60 / 1440) * 100);

    const tuesday = layoutDayEvents([lateNight], nextDay);
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0].topPercent).toBe(0);
    expect(tuesday[0].heightPercent).toBeCloseTo((60 / 1440) * 100);
  });

  it('drops events that do not touch the given day', () => {
    const tomorrow = {
      id: 2,
      startAt: new Date(2026, 9, 20, 10, 0).toISOString(),
      endAt: new Date(2026, 9, 20, 11, 0).toISOString(),
    };

    expect(layoutDayEvents([tomorrow], day)).toHaveLength(0);
  });

  it('sorts unsorted input by start time', () => {
    const result = layoutDayEvents([event(2, 14, 15), event(1, 9, 10)], day);

    expect(result.map((item) => item.event.id)).toEqual([1, 2]);
  });
});
