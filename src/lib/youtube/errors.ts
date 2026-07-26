export function isChartNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("videochartnotfound") ||
    message.includes("chart is not supported") ||
    message.includes("requested entity was not found")
  );
}
