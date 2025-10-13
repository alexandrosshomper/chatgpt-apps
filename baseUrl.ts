const normalizeUrl = (value: string) => {
  const trimmed = value.trim().replace(/\/$/, "");

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
};

const resolveDeploymentUrl = () => {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : undefined,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return normalizeUrl(candidate);
    }
  }

  console.warn(
    "baseURL: falling back to http://localhost:3000 because no deployment URL environment variable was found."
  );

  return "http://localhost:3000";
};

export const baseURL = resolveDeploymentUrl();
