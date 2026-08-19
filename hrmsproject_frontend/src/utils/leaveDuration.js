// Formats a leave duration as "1 Day" (singular) or "N Days" (plural, N != 1),
// e.g. for half-day leaves ("0.5 Days") and multi-day leaves ("3 Days").
export const formatLeaveDuration = (days) => {
    const value = Number(days) || 0;
    const label = Number.isInteger(value) ? value : value.toFixed(1);
    return `${label} ${value === 1 ? 'Day' : 'Days'}`;
};
