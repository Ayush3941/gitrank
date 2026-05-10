"use client";

import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const filters = ["All", "Merged", "Open", "Docs", "Tests", "Bug Fixes", "Infra", "Security", "Performance", "High XP"] as const;

export function ContributionFilters({
  value,
  onValueChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact") => void;
}) {
  return (
    <div className="space-y-4">
      <Tabs value={value} onValueChange={onValueChange}>
        <TabsList className="scrollbar-thin w-full overflow-x-auto whitespace-nowrap">
          {filters.map((filter) => (
            <TabsTrigger key={filter} value={filter}>
              {filter}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-3 lg:grid-cols-[1fr,16rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-11"
            placeholder="Search repo, PR title, or owner"
            aria-label="Search contributions"
          />
        </div>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger aria-label="Sort contributions">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Newest">Newest</SelectItem>
            <SelectItem value="Highest XP">Highest XP</SelectItem>
            <SelectItem value="Highest Difficulty">Highest Difficulty</SelectItem>
            <SelectItem value="Highest Impact">Highest Impact</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
