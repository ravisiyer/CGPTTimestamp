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

    let remainingMs = totalMilliseconds;
    const displayParts = [];

    const days = Math.floor(remainingMs / MS_PER_DAY);
    remainingMs %= MS_PER_DAY;
    if (days > 0) displayParts.push(`${days}d`);

    const hrs = Math.floor(remainingMs / MS_PER_HOUR);
    remainingMs %= MS_PER_HOUR;
    if (hrs > 0) displayParts.push(`${hrs}h`);

    const mins = Math.floor(remainingMs / MS_PER_MINUTE);
    remainingMs %= MS_PER_MINUTE;
    if (mins > 0) displayParts.push(`${mins}m`);

    const secs = Math.floor(remainingMs / MS_PER_SECOND);
    const millisecs = remainingMs % MS_PER_SECOND;

    if (secs > 0) displayParts.push(`${secs}s`);

    if (includeMilliseconds) {
        displayParts.push(`${millisecs}ms`);
    }

    let result;
    if (displayParts.length === 0) {
        // This handles cases where totalMilliseconds is 0, or only had milliseconds and includeMilliseconds is false
        if (totalMilliseconds === 0) {
            result = includeMilliseconds ? '0s 0ms' : '0s';
        } else {
            // This means totalMilliseconds was > 0, but only had milliseconds, and includeMilliseconds is false.
            result = '0s';
        }
    } else {
        result = displayParts.join(' ');
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
 * @returns {string} The formatted date-time string.
 */
export const formatDateTime = (isoString, includeMilliseconds, userLocale) => {
    const date = new Date(isoString);

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
};
