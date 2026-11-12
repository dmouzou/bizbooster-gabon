/**
 * Event validation utilities for BizBooster Gabon.
 * Validates date and time format and ensures that events are strictly scheduled in the future.
 */

export interface EventScheduleValidationResult {
  isValid: boolean;
  error?: string;
  field?: 'date' | 'time' | 'both';
}

/**
 * Checks if a string is a valid ISO date format (YYYY-MM-DD) and represents a valid calendar day.
 */
export function isValidDateString(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return false;

  return true;
}

/**
 * Checks if a string is a valid 24h time format (HH:mm).
 */
export function isValidTimeString(timeStr?: string | null): boolean {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;

  return true;
}

/**
 * Parses event date and time into a Date object.
 */
export function parseEventDateTime(eventDate: string, eventTime?: string): Date | null {
  if (!isValidDateString(eventDate)) return null;

  const formattedDate = eventDate.trim();
  let hours = '00';
  let minutes = '00';

  if (eventTime && isValidTimeString(eventTime)) {
    const parts = eventTime.trim().split(':');
    hours = parts[0].padStart(2, '0');
    minutes = parts[1].padStart(2, '0');
  }

  const d = new Date(`${formattedDate}T${hours}:${minutes}:00`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Validates an event's schedule during publication or edition.
 * Ensures:
 * 1. Date is provided and represents a valid calendar date.
 * 2. Time is provided (format 24h) and valid.
 * 3. The combined datetime is strictly in the future (cannot be in the past).
 */
export function validateEventSchedule(
  eventDate?: string | null,
  eventTime?: string | null,
  referenceNow: number = Date.now()
): EventScheduleValidationResult {
  // 1. Date présence
  if (!eventDate || !eventDate.trim()) {
    return {
      isValid: false,
      field: 'date',
      error: "Veuillez indiquer la date de l'événement.",
    };
  }

  // 2. Date format
  if (!isValidDateString(eventDate)) {
    return {
      isValid: false,
      field: 'date',
      error: "La date de l'événement n'est pas valide.",
    };
  }

  // 3. Heure présence
  if (!eventTime || !eventTime.trim()) {
    return {
      isValid: false,
      field: 'time',
      error: "Veuillez indiquer l'heure de début de l'événement (format 24h).",
    };
  }

  // 4. Heure format
  if (!isValidTimeString(eventTime)) {
    return {
      isValid: false,
      field: 'time',
      error: "L'heure de l'événement n'est pas valide (format HH:mm attendu).",
    };
  }

  // 5. Datetime parsing
  const eventDateTime = parseEventDateTime(eventDate, eventTime);
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    return {
      isValid: false,
      field: 'both',
      error: "La date ou l'heure de l'événement n'est pas valide.",
    };
  }

  // 6. Strictement dans le futur
  if (eventDateTime.getTime() <= referenceNow) {
    return {
      isValid: false,
      field: 'both',
      error: "Un événement ne peut pas être défini dans le passé, uniquement dans le futur. Veuillez choisir une date et une heure à venir.",
    };
  }

  return { isValid: true };
}
