export function truncate(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function truncateWithTooltip(
  text: string,
  maxLength: number
): {
  displayText: string;
  title: string;
  isTruncated: boolean;
} {
  if (!text) return { displayText: "", title: "", isTruncated: false };

  const isTruncated = text.length > maxLength;
  return {
    displayText: isTruncated ? text.slice(0, maxLength) + "..." : text,
    title: text,
    isTruncated,
  };
}
