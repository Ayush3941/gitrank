import { cn } from "@/lib/cn";

export function ClampedText({
  text,
  lines = 2,
  className,
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  return (
    <p
      className={cn("break-anywhere", className)}
      style={{
        display: "-webkit-box",
        WebkitLineClamp: `${Math.max(1, lines)}`,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {text}
    </p>
  );
}
