// Display formatting in the device's locale. Kept apart from time.ts, whose output tests pin down.

export const formatTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatDayLong = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const formatDateLong = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatDayShort = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const monthShort = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short' });
