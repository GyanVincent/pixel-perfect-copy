/**
 * Returns the best display name for a user, falling back to the
 * email prefix (e.g. `johndoe@gmail.com` → `JohnDoe`) and finally `Member`.
 */
export function displayName(
  fullName?: string | null,
  email?: string | null,
): string {
  const name = (fullName || "").trim();
  if (name && name.toLowerCase() !== "member") return name;
  const prefix = (email || "").split("@")[0] || "";
  if (!prefix) return "Member";
  // Capitalize first letter, keep the rest as-is.
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/** Deterministic accent color for an avatar based on a string seed. */
export function avatarColor(seed: string): string {
  const palette = [
    "hsl(0, 70%, 55%)",
    "hsl(25, 80%, 55%)",
    "hsl(45, 80%, 50%)",
    "hsl(140, 55%, 45%)",
    "hsl(175, 60%, 42%)",
    "hsl(205, 70%, 52%)",
    "hsl(245, 65%, 60%)",
    "hsl(280, 60%, 58%)",
    "hsl(320, 65%, 55%)",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function initial(name?: string | null, email?: string | null): string {
  const n = displayName(name, email);
  return n.charAt(0).toUpperCase() || "M";
}
