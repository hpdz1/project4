import { describe, expect, it } from "vitest";
import {
  addDays,
  findDeliveryWindow,
  findExpectedDate,
  formatMailDate,
  inferYear,
  localDateIn,
  parseDateAt,
  parseDatePhrase,
  parseMailDate,
  parseTimeWindow,
  weekdayOf,
  zonedTime,
} from "./dates";

// 2026-10-08 is a Thursday.
const REF = "2026-10-08";

describe("parseDatePhrase", () => {
  it.each([
    ["Tuesday, October 13", "2026-10-13"],
    ["Tue, Oct 13", "2026-10-13"],
    ["Tues. Oct. 13", "2026-10-13"],
    ["October 13, 2026", "2026-10-13"],
    ["Oct 13 2026", "2026-10-13"],
    ["Sept 30", "2026-09-30"],
    ["13 October 2026", "2026-10-13"],
    ["Thursday 8 October 2026", "2026-10-08"],
    ["10/13/2026", "2026-10-13"],
    ["10/13/26", "2026-10-13"],
    ["10/13", "2026-10-13"],
    ["Thursday 10/08/2026 3:15 PM - 5:15 PM", "2026-10-08"],
    ["Thu, 10/08/2026", "2026-10-08"],
    ["Monday,  05/18/2020", "2020-05-18"],
    ["2026-10-13", "2026-10-13"],
    ["2026-10-13T20:00:00-07:00", "2026-10-13"],
    ["Today", "2026-10-08"],
    ["today, October 8", "2026-10-08"],
    ["TOMORROW", "2026-10-09"],
    ["tonight", "2026-10-08"],
    ["Thursday", "2026-10-08"],
    ["Friday", "2026-10-09"],
    ["Wednesday", "2026-10-14"],
    ["Mon", "2026-10-12"],
  ])("%j -> %s", (phrase, expected) => {
    expect(parseDatePhrase(phrase, REF)).toBe(expected);
  });

  it.each(["Pending", "soon", "13/45", "February 30", "Monitor", "", "Order 12345"])("rejects %j", (phrase) => {
    expect(parseDatePhrase(phrase, REF)).toBeNull();
  });

  it("resolves only dated phrases without a reference date", () => {
    expect(parseDatePhrase("October 13, 2026", null)).toBe("2026-10-13");
    expect(parseDatePhrase("October 13", null)).toBeNull();
    expect(parseDatePhrase("Tomorrow", null)).toBeNull();
  });

  it("reports where the phrase ends", () => {
    expect(parseDateAt("  Tue, Oct 13 by 8pm", REF)).toEqual({ date: "2026-10-13", end: 13 });
  });
});

describe("year inference", () => {
  it("rolls into next year across the boundary (email Dec 30 -> 'Monday, January 4')", () => {
    expect(parseDatePhrase("Monday, January 4", "2026-12-30")).toBe("2027-01-04");
    expect(parseDatePhrase("Jan 2", "2026-12-30")).toBe("2027-01-02");
    expect(parseDatePhrase("1/4", "2026-12-30")).toBe("2027-01-04");
  });

  it("keeps recent past dates in the email's year", () => {
    expect(parseDatePhrase("December 28", "2026-12-30")).toBe("2026-12-28");
    expect(parseDatePhrase("Sep 20", REF)).toBe("2026-09-20");
  });

  it("looks back to last year for an early-January email about late December", () => {
    expect(parseDatePhrase("Wednesday, December 30", "2027-01-02")).toBe("2026-12-30");
  });

  it("uses the window [ref - 30d, ref + 330d]", () => {
    expect(inferYear(9, 8, REF)).toBe("2026-09-08"); // 30 days back
    expect(inferYear(9, 1, REF)).toBe("2027-09-01"); // 37 days back is out; 328 days ahead is in
    expect(inferYear(10, 8, REF)).toBe("2026-10-08");
  });

  it("trusts a printed weekday over the window", () => {
    // 2026-09-02 is a Wednesday, 2027-09-02 a Thursday.
    expect(inferYear(9, 2, REF, 3)).toBe("2026-09-02");
    expect(parseDatePhrase("Wednesday, September 2", REF)).toBe("2026-09-02");
    expect(parseDatePhrase("September 2", REF)).toBe("2027-09-02");
  });

  it("finds the year a day exists in (Feb 29)", () => {
    expect(inferYear(2, 29, "2028-01-15")).toBe("2028-02-29");
    expect(inferYear(2, 29, "2027-01-15")).toBe("2028-02-29");
    expect(inferYear(2, 30, REF)).toBeNull();
  });
});

describe("findExpectedDate", () => {
  it.each([
    ["Estimated Delivery on: Saturday, Oct 10", "2026-10-10"],
    ["SCHEDULED DELIVERY\nPending\nSTANDARD TRANSIT\nSat, 10/10/2026", "2026-10-10"],
    ["Scheduled Delivery\nFriday 10/09/2026\n9:00 AM - 1:00 PM", "2026-10-09"],
    ["Estimated Delivery Date: Monday,  10/12/2026", "2026-10-12"],
    ["USPS® Expected Delivery on Saturday, October 10, 2026 Between 11:30am and 3:30pm 9400111899223197428497", "2026-10-10"],
    ["Your item is out for delivery on October 8, 2026 at 7:10 am in SPRINGFIELD, ZZ 00000.", "2026-10-08"],
    ["USPS expects to deliver your package today between 11:30am and 3:30pm.", "2026-10-08"],
    ["Your package was shipped!\nArriving Monday", "2026-10-12"],
    ["your estimated delivery date is:\ntomorrow, October 9", "2026-10-09"],
    ["It’s now arriving:\n\nFriday, October 9\nPreviously expected:October 14 - October 15", "2026-10-09"],
    ["Now expected October 9 - October 10. Track your delivery.", "2026-10-10"],
    ["Now expected October 9-11.", "2026-10-11"],
    ["Your package with 1 item will be delivered today.", "2026-10-08"],
    ["is scheduled for delivery TODAY by End of Day.", "2026-10-08"],
    ["Delivery estimate: Oct 12 - Oct 14", "2026-10-14"],
  ])("%j", (text, expected) => {
    expect(findExpectedDate(text, REF)?.date).toBe(expected);
  });

  it("ignores a previously expected date and unlabeled dates", () => {
    expect(findExpectedDate("Previously expected: October 14", REF)).toBeNull();
    expect(findExpectedDate("Ordered on October 1, 2026. Total $21.38", REF)).toBeNull();
  });

  it("does not read a time window as a date range", () => {
    const m = findExpectedDate("Scheduled Delivery: Thu, 10/08/2026 2:30 PM - 6:30 PM", REF);
    expect(m?.date).toBe("2026-10-08");
  });
});

describe("time windows", () => {
  it.each([
    ["between 2:15 PM and 6:15 PM", "2:15 PM - 6:15 PM"],
    ["Between 11:30am and 3:30pm", "11:30 AM - 3:30 PM"],
    ["02:30 PM  -  06:30 PM", "2:30 PM - 6:30 PM"],
    ["Friday, September 11, 5 p.m - 10 p.m.", "5:00 PM - 10:00 PM"],
    ["10:30 - 2:30 PM", "10:30 AM - 2:30 PM"],
    ["2:30 - 6:30 PM", "2:30 PM - 6:30 PM"],
    ["arriving by 9:00pm", "by 9:00 PM"],
    ["by End of Day", "by end of day"],
  ])("%j -> %j", (text, expected) => {
    expect(parseTimeWindow(text)).toBe(expected);
  });

  it.each(["8 to 10", "Call 1-800-555-0100", "Total 12.50", ""])("no window in %j", (text) => {
    expect(parseTimeWindow(text)).toBeNull();
  });

  it("needs delivery wording before a window found away from the date", () => {
    expect(findDeliveryWindow("Customer service: 8:00 AM - 8:00 PM daily")).toBeNull();
    expect(findDeliveryWindow("USPS expects to deliver your package today between 11:30am and 3:30pm.")).toBe(
      "11:30 AM - 3:30 PM",
    );
  });
});

describe("mail Date headers", () => {
  it.each([
    ["Wed, 7 Oct 2026 08:49:44 -0700", "2026-10-07T15:49:44.000Z", -420],
    ["Thu, 8 Oct 2026 09:14:02 -0700 (PDT)", "2026-10-08T16:14:02.000Z", -420],
    ["Thu, 08 Oct 2026 11:33:40 +0000", "2026-10-08T11:33:40.000Z", 0],
    ["8 Oct 2026 11:33 GMT", "2026-10-08T11:33:00.000Z", 0],
    ["Thu, 8 Oct 2026 09:14:02 EDT", "2026-10-08T13:14:02.000Z", -240],
    ["Thu, 8 Oct 2026 09:14:02 +05:30", "2026-10-08T03:44:02.000Z", 330],
    ["2026-10-08T10:00:00Z", "2026-10-08T10:00:00.000Z", 0],
    ["2026-10-08T10:00:00", "2026-10-08T10:00:00.000Z", null],
  ])("%j", (raw, iso, offset) => {
    const parsed = parseMailDate(raw);
    expect(parsed?.date.toISOString()).toBe(iso);
    expect(parsed?.offsetMinutes).toBe(offset);
  });

  it.each(["garbage", "", "Mon, Oct 6, 2026 at 9:12 AM", "32 Oct 2026 10:00:00 +0000", "1 Foo 2026 10:00 +0000"])(
    "rejects %j",
    (raw) => {
      expect(parseMailDate(raw)).toBeNull();
    },
  );
});

describe("calendar and zone helpers", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayOf("2026-10-08")).toBe(4);
  });

  it("converts between instants and local wall clocks", () => {
    const at = zonedTime("2026-10-08", 7, 5, "America/Chicago");
    expect(at.toISOString()).toBe("2026-10-08T12:05:00.000Z");
    expect(formatMailDate(at, "America/Chicago")).toBe("Thu, 08 Oct 2026 07:05:00 -0500");
    expect(localDateIn(new Date("2026-10-08T03:00:00Z"), "America/Los_Angeles")).toBe("2026-10-07");
    expect(localDateIn(new Date("2026-10-08T20:00:00Z"), "Asia/Tokyo")).toBe("2026-10-09");
  });

  it("handles DST changes", () => {
    // US clocks fall back on 2026-11-01.
    expect(zonedTime("2026-11-02", 9, 0, "America/New_York").toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(zonedTime("2026-10-31", 9, 0, "America/New_York").toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });
});
