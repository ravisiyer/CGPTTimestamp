// util.js

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
 * @returns {string} The formatted duration string.
 */
export const formatInterval = (totalMilliseconds) => {
  // Conditional logging: only log if not in production environment
  if (TEST_FORMAT_INTERVAL) {
    console.log(`\n--- formatInterval called with totalMilliseconds: ${totalMilliseconds} ---`);
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

  const days = Math.floor(totalMilliseconds / MS_PER_DAY);
  let remainderMs = totalMilliseconds % MS_PER_DAY;
  if (TEST_FORMAT_INTERVAL) {
    console.log(`Days: ${days}, Remainder after days: ${remainderMs}ms`);
  }

  const hrs = Math.floor(remainderMs / MS_PER_HOUR);
  remainderMs %= MS_PER_HOUR;
  if (TEST_FORMAT_INTERVAL) {
    console.log(`Hours: ${hrs}, Remainder after hours: ${remainderMs}ms`);
  }

  const mins = Math.floor(remainderMs / MS_PER_MINUTE);
  remainderMs %= MS_PER_MINUTE;
  if (TEST_FORMAT_INTERVAL) {
    console.log(`Minutes: ${mins}, Remainder after minutes: ${remainderMs}ms`);
  }

  const secs = Math.floor(remainderMs / MS_PER_SECOND);
  const millisecs = remainderMs % MS_PER_SECOND;
  if (TEST_FORMAT_INTERVAL) {
    console.log(`Seconds: ${secs}, Milliseconds: ${millisecs}`);
  }

  let result = '';
  if (days > 0) result += `${days}d `;
  if (hrs > 0 || days > 0) result += `${hrs}h `;
  if (mins > 0 || hrs > 0 || days > 0) result += `${mins}m `;
  result += `${secs}s `;
  result += `${millisecs}ms`; // Always add milliseconds

  const finalResult = result.trim();
  if (TEST_FORMAT_INTERVAL) {
    console.log(`Final formatted string: "${finalResult}"`);
    console.log(`--- End formatInterval ---`);
  }
  return finalResult;
};