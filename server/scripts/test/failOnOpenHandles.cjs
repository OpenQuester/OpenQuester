module.exports = function failOnOpenHandles(results) {
  const openHandles = Array.isArray(results.openHandles) ? results.openHandles : [];

  if (openHandles.length === 0) {
    return results;
  }

  const details = openHandles
    .map((handle) => (handle instanceof Error ? (handle.stack ?? handle.message) : String(handle)))
    .join("\n\n");

  throw new Error(
    `Jest detected ${openHandles.length} open handle(s) after tests completed:\n\n${details}`
  );
};
