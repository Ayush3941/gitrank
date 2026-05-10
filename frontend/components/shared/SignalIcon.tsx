import {
  Bolt,
  BookOpen,
  CalendarCheck,
  Crown,
  FlaskConical,
  Lock,
  MessageSquareMore,
  ScrollText,
  ServerCog,
  Shield,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { BadgeIcon } from "@/types/gitrank";

const iconMap = {
  bolt: Bolt,
  book: BookOpen,
  calendar: CalendarCheck,
  crown: Crown,
  flask: FlaskConical,
  lock: Lock,
  messages: MessageSquareMore,
  scroll: ScrollText,
  server: ServerCog,
  shield: Shield,
  wrench: Wrench,
} as const;

export function SignalIcon({
  icon,
  className,
}: {
  icon: BadgeIcon;
  className?: string;
}) {
  const Icon = iconMap[icon];
  return <Icon className={cn("h-4 w-4", className)} aria-hidden="true" />;
}
