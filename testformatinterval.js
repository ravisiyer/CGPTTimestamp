// testFormatInterval.js

// Paste the formatInterval function here with the console.logs from above
// If formatInterval is in a separate file (e.g., utils.js), you'd use:
// const formatInterval = require('./utils').formatInterval;

const formatInterval = (totalMilliseconds) => {
    console.log(`\n--- formatInterval called with totalMilliseconds: ${totalMilliseconds} ---`);

    if (totalMilliseconds === null || isNaN(totalMilliseconds)) {
        console.log("Input is null or NaN, returning empty string.");
        return '';
    }

    const MS_PER_SECOND = 1000;
    const MS_PER_MINUTE = 60 * MS_PER_SECOND;
    const MS_PER_HOUR = 60 * MS_PER_MINUTE;
    const MS_PER_DAY = 24 * MS_PER_HOUR;

    console.log(`Constants: MS_PER_SECOND=${MS_PER_SECOND}, MS_PER_MINUTE=${MS_PER_MINUTE}, MS_PER_HOUR=${MS_PER_HOUR}, MS_PER_DAY=${MS_PER_DAY}`);

    const days = Math.floor(totalMilliseconds / MS_PER_DAY);
    let remainderMs = totalMilliseconds % MS_PER_DAY;
    console.log(`Days: ${days}, Remainder after days: ${remainderMs}ms`);

    const hrs = Math.floor(remainderMs / MS_PER_HOUR);
    remainderMs %= MS_PER_HOUR;
    console.log(`Hours: ${hrs}, Remainder after hours: ${remainderMs}ms`);

    const mins = Math.floor(remainderMs / MS_PER_MINUTE);
    remainderMs %= MS_PER_MINUTE;
    console.log(`Minutes: ${mins}, Remainder after minutes: ${remainderMs}ms`);

    const secs = Math.floor(remainderMs / MS_PER_SECOND);
    const millisecs = remainderMs % MS_PER_SECOND;
    console.log(`Seconds: ${secs}, Milliseconds: ${millisecs}`);

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hrs > 0 || days > 0) result += `${hrs}h `;
    if (mins > 0 || hrs > 0 || days > 0) result += `${mins}m `;
    result += `${secs}s `;
    result += `${millisecs}ms`;

    const finalResult = result.trim();
    console.log(`Final formatted string: "${finalResult}"`);
    console.log(`--- End formatInterval ---`);
    return finalResult;
};


// --- Test Driver ---
const testCases = [
  { input: 0, expected: '0s 0ms', name: 'Zero milliseconds' },
  { input: 1, expected: '0s 1ms', name: 'One millisecond' },
  { input: 999, expected: '0s 999ms', name: '999 milliseconds' },
  { input: 1000, expected: '1s 0ms', name: 'One second exact' },
  { input: 1001, expected: '1s 1ms', name: 'One second one millisecond' },
  { input: 59000, expected: '59s 0ms', name: '59 seconds exact' },
  { input: 59999, expected: '59s 999ms', name: '59 seconds 999 milliseconds' },
  { input: 60000, expected: '1m 0s 0ms', name: 'One minute exact' },
  { input: 60500, expected: '1m 0s 500ms', name: 'One minute 500 milliseconds' },
  { input: 61000, expected: '1m 1s 0ms', name: 'One minute one second exact' },
  { input: 3599000, expected: '59m 59s 0ms', name: 'Almost one hour' },
  { input: 3600000, expected: '1h 0m 0s 0ms', name: 'One hour exact' },
  { input: 3601000, expected: '1h 0m 1s 0ms', name: 'One hour one second' },
  { input: 3661000, expected: '1h 1m 1s 0ms', name: 'One hour one minute one second' },
  { input: 86399000, expected: '23h 59m 59s 0ms', name: 'Almost one day' },
  { input: 86400000, expected: '1d 0h 0m 0s 0ms', name: 'One day exact' },
  { input: 86401000, expected: '1d 0h 0m 1s 0ms', name: 'One day one second' },
  { input: 90061001, expected: '1d 1h 1m 1s 1ms', name: 'Complex combination' },
  { input: 123456789, expected: '1d 10h 17m 36s 789ms', name: 'Arbitrary large number' },
  { input: null, expected: '', name: 'Null input' },
  { input: undefined, expected: '', name: 'Undefined input' }, // NaN will also return empty string
  { input: NaN, expected: '', name: 'NaN input' },
];

console.log("Starting tests for formatInterval function...\n");

testCases.forEach((test, index) => {
  console.log(`\n--- Test Case ${index + 1}: ${test.name} ---`);
  const actual = formatInterval(test.input);

  console.log(`Input: ${test.input}`);
  console.log(`Expected: "${test.expected}"`);
  console.log(`Actual: "${actual}"`);

  if (actual === test.expected) {
    console.log('✅ PASS');
  } else {
    console.error('❌ FAIL');
    console.error(`  Expected: "${test.expected}", Got: "${actual}"`);
  }
  console.log(`--- End Test Case ${index + 1} ---`);
});

console.log("\nAll tests completed.");