import * as Localization from 'expo-localization';
import { DEFAULT_TIMEZONE } from '@nextstep/contracts';
import { ApiError, NetworkError } from './api';

export function deviceTimezone(): string {
  return Localization.getCalendars()[0]?.timeZone ?? DEFAULT_TIMEZONE;
}

export function authErrorMessage(e: unknown): string {
  if (e instanceof NetworkError) return 'Can’t reach NextStep. This step needs a connection — check your data or Wi-Fi and try again.';
  if (e instanceof ApiError) {
    if (e.code === 'VALIDATION_FAILED' && Array.isArray(e.details)) return (e.details as Array<{ message: string }>).map((d) => d.message).join('. ');
    if (e.code === 'RATE_LIMITED') return 'Too many attempts. Please wait a minute and try again.';
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
