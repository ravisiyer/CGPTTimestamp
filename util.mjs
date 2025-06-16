// util.mjs

// This constant is evaluated only once when the module loads.
// Logs will appear if NOT in production AND if ENABLE_FORMAT_INTERVAL_LOGS environment variable is 'true'.
const TEST_FORMAT_INTERVAL = process.env.NODE_ENV !== 'production' &&
                             process.env.ENABLE_FORMAT_INTERVAL_LOGS === 'true';

// # To run formatInterval method test driver (formatInterval.test.mjs) with the formatInterval logs ENABLED:
// $env:ENABLE_FORMAT_INTERVAL_LOGS="true"; node ./formatInterval.test.mjs

/**
 * Formats a total duration in milliseconds into a human-readable string (e.g., "1d 2h 3m 4s 500ms").
 * Console logs are conditional based on TEST_FORMAT_INTERVAL.
 *
 * @param {number} totalMilliseconds - The total duration in milliseconds.
 * @param {boolean} [includeMilliseconds=true] - Whether to include milliseconds in the output string.
 * @returns {string} The formatted duration string.
 */
export const formatInterval = (totalMilliseconds, includeMilliseconds = true) => {
    if (TEST_FORMAT_INTERVAL) {
        console.log(`\n--- formatInterval called with totalMilliseconds: ${totalMilliseconds}, includeMilliseconds: ${includeMilliseconds} ---`);
    }

    if (totalMilliseconds === null || isNaN(totalMilliseconds)) {
        if (TEST_FORMAT_INTERVAL) {
            console.log("Input is null or NaN, returning empty string.");
        }
        return '';
    }

    const MS_PER_SECOND = 1000;
    const MS_PER_MINUTE = 60 * MS_PER_SECOND;
    const MS_PER_HOUR = 60 * MS_PER_MINUTE;
    const MS_PER_DAY = 24 * MS_PER_HOUR;

    if (TEST_FORMAT_INTERVAL) {
        console.log(`Constants: MS_PER_SECOND=${MS_PER_SECOND}, MS_PER_MINUTE=${MS_PER_MINUTE}, MS_PER_HOUR=${MS_PER_HOUR}, MS_PER_DAY=${MS_PER_DAY}`);
    }

    let ms = totalMilliseconds;

    // Round the total milliseconds to the nearest second if milliseconds are not included in the final output
    if (!includeMilliseconds) {
        ms = Math.round(ms / MS_PER_SECOND) * MS_PER_SECOND;
    }

    const parts = [];
    let hasHigherUnit = false; // Flag to track if any D, H, or M unit was added

    const days = Math.floor(ms / MS_PER_DAY);
    ms %= MS_PER_DAY;
    if (days > 0) {
        parts.push(`${days}d`);
        hasHigherUnit = true;
    }

    const hours = Math.floor(ms / MS_PER_HOUR);
    ms %= MS_PER_HOUR;
    // Include hours if > 0 OR if days are present (to show 0h), to maintain hierarchy
    if (hours > 0 || hasHigherUnit) {
        parts.push(`${hours}h`);
        if (hours > 0) hasHigherUnit = true; // Update flag if hours are non-zero
    }

    const minutes = Math.floor(ms / MS_PER_MINUTE);
    ms %= MS_PER_MINUTE;
    // Include minutes if > 0 OR if days or hours are present (to show 0m), to maintain hierarchy
    if (minutes > 0 || hasHigherUnit) {
        parts.push(`${minutes}m`);
        if (minutes > 0) hasHigherUnit = true; // Update flag if minutes are non-zero
    }

    const seconds = Math.floor(ms / MS_PER_SECOND);
    const milliseconds = ms % MS_PER_SECOND;

    // Add seconds if > 0 OR if any higher units were already pushed OR if no units have been pushed yet (e.g., totalMilliseconds was 0 or only had ms)
    if (seconds > 0 || hasHigherUnit || parts.length === 0) {
        parts.push(`${seconds}s`);
    }

    if (includeMilliseconds) {
        // Always add milliseconds if requested
        parts.push(`${milliseconds}ms`);
    }

    let result = parts.join(' ').trim();

    // Handle edge cases where the result might be empty (e.g., only ms were present and not included)
    if (result === '') {
        // This means totalMilliseconds was > 0, consisted only of milliseconds, and includeMilliseconds was false,
        // causing 'ms' to round to 0 and no higher units were present.
        return '0s';
    }

    if (TEST_FORMAT_INTERVAL) {
        console.log(`Final formatted string: "${result}"`);
        console.log(`--- End formatInterval ---`);
    }
    return result;
};


/**
 * Formats an ISO timestamp string into a human-readable date-time string.
 *
 * @param {string} isoString - The ISO timestamp string.
 * @param {boolean} includeMilliseconds - Whether to include milliseconds.
 * @param {string} userLocale - The user's locale string (e.g., 'en-US').
 * @param {boolean} [isExport=false] - Whether the format is for CSV export (changes format to YYYY-MM-DD HH:MM:SS[.sss]).
 * @returns {string} The formatted date-time string.
 */
export const formatDateTime = (isoString, includeMilliseconds, userLocale, isExport = false) => {
    const date = new Date(isoString);

    if (isExport) {
        // Construct YYYY-MM-DD HH:MM:SS.sss or YYYY-MM-DD HH:MM:SS for CSV
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

        let dateTimeString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        if (includeMilliseconds) {
            dateTimeString += `.${milliseconds}`;
        }
        return dateTimeString;
    } else {
        // Existing logic for UI display using locale-specific formatting
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true,
        };
        let dateTimePart = date.toLocaleString(userLocale, options);
        if (includeMilliseconds) {
            const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
            return `${dateTimePart} (${milliseconds}ms)`;
        } else {
            return dateTimePart;
        }
    }
};
