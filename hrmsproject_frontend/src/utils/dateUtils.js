/**
 * Utility to restrict the year component of an HTML5 date or month input to 4 digits.
 * Chrome's native date picker allows typing up to 6 digits (e.g. 275760). 
 * This strips any digits beyond 4 for the year part when a user is typing.
 *
 * @param {string} value The current string value from e.target.value (e.g., "12345-01-01" or "12345-01")
 * @returns {string} The truncated value with a max 4-digit year.
 */
export const enforceFourDigitYear = (value) => {
    if (!value) return value;
    
    // HTML5 date values are strictly "YYYY-MM-DD" or "YYYY-MM"
    const parts = value.split('-');
    
    // If the year part is somehow more than 4 characters, cap it at 4.
    if (parts.length > 0 && parts[0].length > 4) {
        // e.g., "12345" becomes "1234"
        parts[0] = parts[0].substring(0, 4);
        return parts.join('-');
    }
    
    return value;
};
