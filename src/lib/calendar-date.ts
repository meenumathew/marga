const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A date as the YYYY-MM-DD calendar day it falls on in the reader's own timezone.
 *
 * Built from the local getters rather than `toLocaleDateString("en-CA")`, which
 * depends on the runtime shipping ICU locale data: without it the format changes
 * and every stamped day stops matching `isCalendarDate`, so streaks and activity
 * silently read as empty.
 */
export function localDateStamp(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

export function isCalendarDate(value: string): boolean {
  const match = calendarDatePattern.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    return false;
  }

  return day >= 1 && day <= daysInMonth(year, month);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
