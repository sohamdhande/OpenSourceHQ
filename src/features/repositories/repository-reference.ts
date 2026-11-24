export interface GitHubRepositoryReference {
  owner: string;
  name: string;
}

export function parseGitHubRepositoryReference(input: string): GitHubRepositoryReference | null {
  const raw = input.trim();
  let candidate = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname.toLowerCase() !== "github.com" || url.username || url.password || url.search || url.hash) return null;
      candidate = url.pathname.replace(/^\/+|\/+$/g, "");
    } catch {
      return null;
    }
  } else if (raw.includes("://") || raw.includes("?")) {
    return null;
  }

  const parts = candidate.split("/");
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner)) return null;
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name)) return null;
  const normalizedName = name.replace(/\.git$/i, "");
  if (!normalizedName || normalizedName === "." || normalizedName === "..") return null;
  return { owner, name: normalizedName };
}
