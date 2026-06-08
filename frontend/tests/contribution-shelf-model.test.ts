import { describe, expect, it } from "vitest";
import {
  buildContributionShelfModel,
  resolveContributionCardPageSize,
} from "@/features/contributions/lib/contribution-shelf-model";
import { buildContribution } from "@/tests/helpers/contribution-fixture";

describe("buildContributionShelfModel", () => {
  it("deduplicates PR rows, builds counts, and paginates capped results", () => {
    const duplicateLowerXp = buildContribution({
      id: "fabric-older-score",
      owner: "hyperledger",
      repo: "fabric-x-evm",
      number: 177,
      xpEarned: 90,
      category: "Backend",
      evidenceSignals: ["backend"],
    });
    const duplicateHigherXp = buildContribution({
      id: "fabric-canonical-score",
      owner: "hyperledger",
      repo: "fabric-x-evm",
      number: 177,
      xpEarned: 240,
      category: "Backend",
      evidenceSignals: ["runtime"],
    });
    const testingPr = buildContribution({
      id: "fsc-test-score",
      owner: "hyperledger-labs",
      repo: "fabric-smart-client",
      number: 1459,
      xpEarned: 280,
      category: "Testing",
    });
    const docsPr = buildContribution({
      id: "docs-score",
      owner: "octo",
      repo: "docs",
      number: 5,
      status: "open",
      xpEarned: 60,
      category: "Documentation",
    });

    const model = buildContributionShelfModel({
      rows: [duplicateLowerXp, duplicateHigherXp, testingPr, docsPr],
      contributions: [duplicateLowerXp, duplicateHigherXp, testingPr, docsPr],
      highXPThreshold: 200,
      scoreHistoryCap: 3,
      filter: "All",
      search: "",
      sort: "Newest",
      debouncedSearch: "",
      deferredFilter: "All",
      deferredSearch: "",
      deferredSort: "Newest",
      visibleCardCount: 2,
      useLiteCards: false,
      showCardDetails: true,
    });

    expect(model.contributionUniverse.map((row) => row.id)).toEqual([
      "fabric-canonical-score",
      "fsc-test-score",
      "docs-score",
    ]);
    expect(model.statusCounts).toMatchObject({ All: 3, Merged: 2, Open: 1 });
    expect(model.focusCounts).toMatchObject({ Any: 3, Tests: 1, Docs: 1, "High XP": 2 });
    expect(model.filteredRows.map((row) => row.id)).toEqual([
      "fabric-canonical-score",
      "fsc-test-score",
      "docs-score",
    ]);
    expect(model.visibleRows.map((row) => row.id)).toEqual([
      "fabric-canonical-score",
      "fsc-test-score",
    ]);
    expect(model.hasMoreRows).toBe(true);
    expect(model.remainingRows).toBe(1);
    expect(model.effectiveShowCardDetails).toBe(true);
    expect(model.canReset).toBe(false);
  });

  it("exposes filtered-empty and transition state without rendering the page", () => {
    const model = buildContributionShelfModel({
      rows: [],
      contributions: [buildContribution()],
      filter: "Tests",
      search: "fabric",
      sort: "Highest XP",
      debouncedSearch: "fabric",
      deferredFilter: "All",
      deferredSearch: "fabric",
      deferredSort: "Highest XP",
      visibleCardCount: 12,
      useLiteCards: false,
      showCardDetails: false,
    });

    expect(model.canReset).toBe(true);
    expect(model.isFiltering).toBe(true);
    expect(model.isFilteredNoResults).toBe(true);
    expect(model.totalContributionEvidence).toBe(1);
  });

  it("uses constrained page sizing and suppresses heavy card details in lite mode", () => {
    const model = buildContributionShelfModel({
      rows: [buildContribution()],
      contributions: [buildContribution()],
      filter: "All",
      search: "",
      sort: "Newest",
      debouncedSearch: "",
      deferredFilter: "All",
      deferredSearch: "",
      deferredSort: "Newest",
      visibleCardCount: 10,
      useLiteCards: true,
      showCardDetails: true,
    });

    expect(model.cardPageSize).toBe(resolveContributionCardPageSize(true));
    expect(model.effectiveShowCardDetails).toBe(false);
    expect(model.abraContributionSample).toHaveLength(1);
  });
});
