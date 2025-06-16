// # To run your tests with the formatInterval logs ENABLED:
// $env:ENABLE_FORMAT_INTERVAL_LOGS="true"; node ./formatInterval.test.mjs

// # To run your tests with the formatInterval logs DISABLED (default if variable is not set or not 'true'):
// node ./formatInterval.test.mjs

import { formatInterval } from './util.mjs'; // Adjust path based on your file structure

// --- Test Driver ---
const testCases = [
    // Tests with milliseconds included (default behavior or explicitly true)
    { input: 0, expected: '0s 0ms', name: 'Zero milliseconds (with ms)', includeMilliseconds: true },
    { input: 1, expected: '0s 1ms', name: 'One millisecond (with ms)', includeMilliseconds: true },
    { input: 999, expected: '0s 999ms', name: '999 milliseconds (with ms)', includeMilliseconds: true },
    { input: 1000, expected: '1s 0ms', name: 'One second exact (with ms)', includeMilliseconds: true },
    { input: 1001, expected: '1s 1ms', name: 'One second one millisecond (with ms)', includeMilliseconds: true },
    { input: 59000, expected: '59s 0ms', name: '59 seconds exact (with ms)', includeMilliseconds: true },
    { input: 59999, expected: '59s 999ms', name: '59 seconds 999 milliseconds (with ms)', includeMilliseconds: true },
    { input: 60000, expected: '1m 0s 0ms', name: 'One minute exact (with ms)', includeMilliseconds: true },
    { input: 60500, expected: '1m 0s 500ms', name: 'One minute 500 milliseconds (with ms)', includeMilliseconds: true },
    { input: 61000, expected: '1m 1s 0ms', name: 'One minute one second exact (with ms)', includeMilliseconds: true },
    { input: 3599000, expected: '59m 59s 0ms', name: 'Almost one hour (with ms)', includeMilliseconds: true },
    { input: 3600000, expected: '1h 0m 0s 0ms', name: 'One hour exact (with ms)', includeMilliseconds: true },
    { input: 3601000, expected: '1h 0m 1s 0ms', name: 'One hour one second (with ms)', includeMilliseconds: true },
    { input: 3661000, expected: '1h 1m 1s 0ms', name: 'One hour one minute one second (with ms)', includeMilliseconds: true },
    { input: 86399000, expected: '23h 59m 59s 0ms', name: 'Almost one day (with ms)', includeMilliseconds: true },
    { input: 86400000, expected: '1d 0h 0m 0s 0ms', name: 'One day exact (with ms)', includeMilliseconds: true },
    { input: 86401000, expected: '1d 0h 0m 1s 0ms', name: 'One day one second (with ms)', includeMilliseconds: true },
    { input: 90061001, expected: '1d 1h 1m 1s 1ms', name: 'Complex combination (with ms)', includeMilliseconds: true },
    { input: 123456789, expected: '1d 10h 17m 36s 789ms', name: 'Arbitrary large number (with ms)', includeMilliseconds: true },
    { input: null, expected: '', name: 'Null input (with ms)' },
    { input: undefined, expected: '', name: 'Undefined input (with ms)' },
    { input: NaN, expected: '', name: 'NaN input (with ms)' },

    // Tests with milliseconds excluded (includeMilliseconds = false)
    { input: 0, expected: '0s', name: 'Zero milliseconds (no ms)', includeMilliseconds: false },
    { input: 1, expected: '0s', name: 'One millisecond (no ms)', includeMilliseconds: false }, // 1ms rounds to 0s
    { input: 499, expected: '0s', name: '499 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 0s
    { input: 500, expected: '1s', name: '500 milliseconds (no ms)', includeMilliseconds: false }, // Corrected: Rounds to 1s
    { input: 999, expected: '1s', name: '999 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 1s
    { input: 1000, expected: '1s', name: 'One second exact (no ms)', includeMilliseconds: false },
    { input: 1001, expected: '1s', name: 'One second one millisecond (no ms)', includeMilliseconds: false },
    { input: 1400, expected: '1s', name: '1 second 400 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 1s
    { input: 1500, expected: '2s', name: '1 second 500 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 2s
    { input: 1900, expected: '2s', name: '1 second 900 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 2s
    { input: 59000, expected: '59s', name: '59 seconds exact (no ms)', includeMilliseconds: false },
    { input: 59499, expected: '59s', name: '59 seconds 499 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 59s
    { input: 59500, expected: '1m 0s', name: '59 seconds 500 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 1m 0s
    { input: 59999, expected: '1m 0s', name: '59 seconds 999 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 1m 0s
    { input: 60000, expected: '1m 0s', name: 'One minute exact (no ms)', includeMilliseconds: false },
    { input: 60500, expected: '1m 1s', name: 'One minute 500 milliseconds (no ms)', includeMilliseconds: false }, // Rounds to 1m 1s
    { input: 61000, expected: '1m 1s', name: 'One minute one second exact (no ms)', includeMilliseconds: false },
    { input: 3599000, expected: '59m 59s', name: 'Almost one hour (no ms)', includeMilliseconds: false },
    { input: 3599500, expected: '1h 0m 0s', name: 'Almost one hour (rounds up to hour) (no ms)', includeMilliseconds: false }, // Rounds to 1h
    { input: 3600000, expected: '1h 0m 0s', name: 'One hour exact (no ms)', includeMilliseconds: false },
    { input: 3601000, expected: '1h 0m 1s', name: 'One hour one second (no ms)', includeMilliseconds: false },
    { input: 3661000, expected: '1h 1m 1s', name: 'One hour one minute one second (no ms)', includeMilliseconds: false },
    { input: 86399000, expected: '23h 59m 59s', name: 'Almost one day (no ms)', includeMilliseconds: false },
    { input: 86399500, expected: '1d 0h 0m 0s', name: 'Almost one day (rounds up to day) (no ms)', includeMilliseconds: false }, // Rounds to 1d
    { input: 86400000, expected: '1d 0h 0m 0s', name: 'One day exact (no ms)', includeMilliseconds: false },
    { input: 86401000, expected: '1d 0h 0m 1s', name: 'One day one second (no ms)', includeMilliseconds: false },
    { input: 90061001, expected: '1d 1h 1m 1s', name: 'Complex combination (no ms)', includeMilliseconds: false },
    { input: 123456789, expected: '1d 10h 17m 37s', name: 'Arbitrary large number (no ms) - rounds up', includeMilliseconds: false }, // 36.789s rounds to 37s
    { input: null, expected: '', name: 'Null input (no ms)' },
    { input: undefined, expected: '', name: 'Undefined input (no ms)' },
    { input: NaN, expected: '', name: 'NaN input (no ms)' },
];

console.log("Starting tests for formatInterval function...\n");

let passedTests = 0;
let failedTests = 0;

testCases.forEach((test, index) => {
    console.log(`\n--- Test Case ${index + 1}: ${test.name} ---`);
    const actual = formatInterval(test.input, test.includeMilliseconds); // Pass the optional parameter

    console.log(`Input: ${test.input}`);
    console.log(`Expected: "${test.expected}"`);
    console.log(`Actual: "${actual}"`);

    if (actual === test.expected) {
        console.log('✅ PASS');
        passedTests++;
    } else {
        console.error('❌ FAIL');
        console.error(`   Expected: "${test.expected}", Got: "${actual}"`);
        failedTests++;
    }
    console.log(`--- End Test Case ${index + 1} ---`);
});

console.log("\nAll tests completed.");
console.log(`Summary: ${passedTests} passed, ${failedTests} failed.`);
console.log(`Total tests: ${testCases.length}`);

if (failedTests > 0) {
    console.error("Some tests failed. Please review the output above.");
} else {
    console.log("All tests passed successfully!");
}
