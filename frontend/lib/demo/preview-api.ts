import {
  getDashboardData,
  getLeaderboard,
  getPrReport,
  getQuests,
  getUserProfile,
} from "@/lib/demo/mock-api";
import { prAnalyses } from "@/lib/mock-data/gitrank";
import type {
  DashboardData,
  FeaturedContribution,
  LeaderboardSnapshot,
  PreviewMode,
  ProfileRepositorySummary,
  ProfileViewData,
  PullRequestAnalysis,
  Quest,
  UserProfile,
} from "@/types/gitrank";

export async function getPreviewDashboardData(preview?: PreviewMode): Promise<DashboardData> {
  return getDashboardData(preview);
}

export async function getPreviewQuests(preview?: PreviewMode): Promise<Quest[]> {
  return getQuests(preview);
}

export async function getPreviewPrReport(
  owner: string,
  repo: string,
  number: number,
  preview?: PreviewMode,
): Promise<PullRequestAnalysis | null> {
  return getPrReport(owner, repo, number, preview);
}

export async function getPreviewLeaderboard(
  tab: Parameters<typeof getLeaderboard>[0],
  preview?: PreviewMode,
): Promise<LeaderboardSnapshot> {
  return getLeaderboard(tab, preview);
}

export async function getPreviewPublicProfile(
  username: string,
  preview?: PreviewMode,
): Promise<ProfileViewData | null> {
  const profile = await getUserProfile(username, preview);
  return profile ? previewProfileView(profile) : null;
}

export async function getPreviewMyProfile(preview?: PreviewMode): Promise<ProfileViewData> {
  const profile = await getUserProfile("Ayush3941", preview);
  if (!profile) {
    throw new Error("Preview profile is unavailable.");
  }
  return previewProfileView(profile);
}

function previewProfileView(user: UserProfile): ProfileViewData {
  return {
    user,
    featuredContributions: previewFeaturedContributions(),
    topRepositories: previewTopRepositories(user),
    recentReports: prAnalyses.slice(0, 4),
    shareHeadline: user.title,
    trendWindowLabel: "Last 6 weeks",
    refreshedAt: user.syncStatus.lastSyncedAt ?? new Date().toISOString(),
    isStale: user.syncStatus.state === "stale",
    partialProfileAvailable: user.syncStatus.partialProfileAvailable,
  };
}

function previewFeaturedContributions(): FeaturedContribution[] {
  return prAnalyses.slice(0, 5).map((report) => ({
    id: report.contribution.id,
    owner: report.contribution.owner,
    repo: report.contribution.repo,
    number: report.contribution.number,
    title: report.contribution.title,
    summary: report.contribution.aiSummary,
    xpEarned: report.contribution.xpEarned,
    happenedAt: report.contribution.mergedAt,
  }));
}

function previewTopRepositories(user: UserProfile): ProfileRepositorySummary[] {
  return user.repositories.map((repository) => {
    const [owner, repo] = splitRepositoryName(repository.name);
    return {
      name: repository.name,
      owner,
      repo,
      totalXp: user.gitRankScore,
      contributionCount: user.contributions.filter(
        (contribution) => `${contribution.owner}/${contribution.repo}` === repository.name,
      ).length,
      visibility: repository.visibility,
      primarySkill: user.topSkills[0],
    };
  });
}

function splitRepositoryName(fullName: string): [string, string] {
  const [owner = "unknown", repo = "repo"] = fullName.split("/", 2);
  return [owner, repo];
}
