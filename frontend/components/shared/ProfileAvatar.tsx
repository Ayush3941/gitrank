import Image from "next/image";
import { cn } from "@/lib/cn";

const avatarSizeClasses = {
  md: "h-[72px] w-[72px]",
  lg: "h-24 w-24",
} as const;

const avatarPixelSizes = {
  md: 72,
  lg: 96,
} as const;

type ProfileAvatarSize = keyof typeof avatarSizeClasses;

export function ProfileAvatar({
  src,
  displayName,
  size = "md",
  priority = false,
  className,
}: {
  src: string;
  displayName: string;
  size?: ProfileAvatarSize;
  priority?: boolean;
  className?: string;
}) {
  const pixels = avatarPixelSizes[size];
  const avatarLabel = displayName.trim()
    ? `${displayName} profile image`
    : "Profile image";

  return (
    <div
      aria-label={avatarLabel}
      className="rank-orbit rounded-[var(--radius-universal)] p-[2px]"
      role="img"
    >
      <Image
        src={src}
        alt=""
        width={pixels}
        height={pixels}
        sizes={`${pixels}px`}
        priority={priority}
        className={cn("cyber-avatar rounded-[var(--radius-universal)]", avatarSizeClasses[size], className)}
      />
    </div>
  );
}
