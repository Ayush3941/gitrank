import Image from "next/image";
import { cn } from "@/lib/cn";

export function BrandLogo({
  size = 20,
  className,
  alt = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/assets/logo.png"
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn("rounded-[0.1rem] object-contain", className)}
    />
  );
}
