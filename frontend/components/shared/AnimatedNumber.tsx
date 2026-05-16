"use client";

export function AnimatedNumber({
  value,
  prefix = "",
}: {
  value: number;
  prefix?: string;
}) {
  return <span>{prefix}{value.toLocaleString("en-US")}</span>;
}
