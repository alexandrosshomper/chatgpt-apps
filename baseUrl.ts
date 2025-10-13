const normalizeUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/$/, "");

  if (!trimmed) {
    return "";
  }

  const lower = trimmed.toLowerCase();

  if (lower === "undefined" || lower === "null") {
    return "";
  }

  const normalized =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  try {
    const { hostname } = new URL(normalized);

    if (!hostname || hostname.toLowerCase() === "undefined") {
      return "";
    }
  } catch {
    return "";
  }

  return normalized;
};

const resolveDeploymentUrl = () => {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_DEPLOYMENT_URL,
    process.env.SITE_URL,
    process.env.BASE_URL,
    process.env.APP_URL,
    process.env.DEPLOYMENT_URL,
    process.env.COOLIFY_URL,
    process.env.COOLIFY_BASE_URL,
    process.env.COOLIFY_APP_URL,
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : undefined,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const normalized = candidate ? normalizeUrl(candidate) : "";

    if (normalized) {
      return normalized;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(
      "baseURL: falling back to http://localhost:3000 because no deployment URL environment variable was found."
    );

    return "http://localhost:3000";
  }

  console.warn(
    "baseURL: falling back to https://flyfish.shomper.de because no deployment URL environment variable was found."
  );

  return "https://flyfish.shomper.de";
};

export const baseURL = resolveDeploymentUrl();
