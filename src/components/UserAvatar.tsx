import { avatarColor, initial } from "@/lib/profile-utils";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  className?: string;
  /** Tailwind text size class, e.g. "text-sm" */
  textClassName?: string;
}

/**
 * Reusable avatar. Shows the uploaded image when available, otherwise
 * a colored circle with the user's initial.
 */
export function UserAvatar({
  name,
  email,
  avatarUrl,
  className,
  textClassName = "text-sm",
}: UserAvatarProps) {
  const seed = (name || email || "u").toLowerCase();
  const letter = initial(name, email);
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full overflow-hidden shrink-0 font-semibold text-white",
        className,
      )}
      style={avatarUrl ? undefined : { background: avatarColor(seed) }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || "User"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={textClassName}>{letter}</span>
      )}
    </div>
  );
}
