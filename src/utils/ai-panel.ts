export const formatTimestamp = (value: string | number | Date | null | undefined): string => {
  if (!value) {
    return 'N/A';
  }

  try {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
  } catch {
    return String(value);
  }
};
