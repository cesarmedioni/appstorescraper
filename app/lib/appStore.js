export function extractAppId(url) {
  const pathParts = url.split('/');
  const lastPart = pathParts[pathParts.length - 1];

  const numericId = lastPart.match(/\d+/);
  if (numericId) {
    return numericId[0];
  }
  throw new Error("Could not extract App ID from URL");
}

export async function fetchAppDetails(appId) {
  const response = await fetch(`/api/app-details?id=${appId}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();

  if (data.results && data.results.length > 0) {
    return data.results[0];
  }
  throw new Error("No app found");
}
