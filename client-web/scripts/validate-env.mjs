const apiUrl = process.env.VITE_API_URL?.trim();

if (process.env.GITHUB_ACTIONS === "true" && !apiUrl) {
  throw new Error(
    "VITE_API_URL is required for hosted web builds. Refusing to create a client that sends API requests to Cloudflare Pages.",
  );
}

if (apiUrl) {
  const parsed = new URL(apiUrl);
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error("VITE_API_URL must use http or https.");
  }
}
