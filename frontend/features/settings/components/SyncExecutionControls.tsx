"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useRunCommitSync,
  useRunInstallationSync,
  useRunIssueSync,
  useRunPullRequestSync,
  useRunRepositorySync,
  useRunReviewSync,
  useRunUserSync,
} from "@/hooks/use-account-actions";
import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

export function SyncExecutionControls() {
  const runRepositorySync = useRunRepositorySync();
  const runUserSync = useRunUserSync();
  const runInstallationSync = useRunInstallationSync();
  const runPullRequestSync = useRunPullRequestSync();
  const runReviewSync = useRunReviewSync();
  const runIssueSync = useRunIssueSync();
  const runCommitSync = useRunCommitSync();

  const [repository, setRepository] = useState("");
  const [userLogin, setUserLogin] = useState("");
  const [installationID, setInstallationID] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [shaInput, setSHAInput] = useState("");
  const [notice, setNotice] = useState("");

  const pending =
    runRepositorySync.isPending ||
    runUserSync.isPending ||
    runInstallationSync.isPending ||
    runPullRequestSync.isPending ||
    runReviewSync.isPending ||
    runIssueSync.isPending ||
    runCommitSync.isPending;

  const actionError = sanitizeUserFacingError(
    (runRepositorySync.error as Error | null)?.message ||
      (runUserSync.error as Error | null)?.message ||
      (runInstallationSync.error as Error | null)?.message ||
      (runPullRequestSync.error as Error | null)?.message ||
      (runReviewSync.error as Error | null)?.message ||
      (runIssueSync.error as Error | null)?.message ||
      (runCommitSync.error as Error | null)?.message ||
      "",
    "settings-sync-controls",
  );

  function parsePositiveInt(value: string): number | null {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  function writeResult(result: ApiSyncExecutionResponse, label: string) {
    const fetchedSummary = countSummary("fetched", result.fetched);
    const persistedSummary = countSummary("persisted", result.persisted);
    const correlation = result.correlation_id?.trim();
    setNotice(
      `${label}: ${result.status}${fetchedSummary}${persistedSummary}${correlation ? ` • correlation ${correlation}` : ""}`,
    );
  }

  function requireRepository(): string | null {
    const normalized = repository.trim();
    if (!normalized) {
      setNotice("Enter repository as owner/repo.");
      return null;
    }
    return normalized;
  }

  function requireNumber(): number | null {
    const parsed = parsePositiveInt(numberInput);
    if (!parsed) {
      setNotice("Enter a positive PR/issue/review number.");
      return null;
    }
    return parsed;
  }

  function requireInstallationID(): number | null {
    const parsed = parsePositiveInt(installationID);
    if (!parsed) {
      setNotice("Enter a positive installation ID.");
      return null;
    }
    return parsed;
  }

  function requireSHA(): string | null {
    const normalized = shaInput.trim();
    if (!normalized) {
      setNotice("Enter commit SHA.");
      return null;
    }
    return normalized;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-primary">Sync execution controls</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Run specific backend sync functions</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          These actions call live gateway execute endpoints and return fetched/persisted counts from GitHub ingestor.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Input
          value={repository}
          onChange={(event) => setRepository(event.target.value)}
          placeholder="owner/repo"
          aria-label="Repository owner slash repo"
        />
        <Input
          value={userLogin}
          onChange={(event) => setUserLogin(event.target.value)}
          placeholder="GitHub login (optional for user sync)"
          aria-label="GitHub login"
        />
        <Input
          value={numberInput}
          onChange={(event) => setNumberInput(event.target.value)}
          placeholder="PR / review / issue number"
          aria-label="PR review issue number"
          inputMode="numeric"
        />
        <Input
          value={installationID}
          onChange={(event) => setInstallationID(event.target.value)}
          placeholder="Installation ID"
          aria-label="Installation ID"
          inputMode="numeric"
        />
        <div className="md:col-span-2">
          <Input
            value={shaInput}
            onChange={(event) => setSHAInput(event.target.value)}
            placeholder="Commit SHA"
            aria-label="Commit SHA"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => {
            const normalizedRepository = requireRepository();
            if (!normalizedRepository) {
              return;
            }
            setNotice("");
            runRepositorySync.mutate(normalizedRepository, {
              onSuccess: (result) => writeResult(result, "Repository sync"),
            });
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Repository
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => {
            setNotice("");
            const login = userLogin.trim();
            runUserSync.mutate(login || undefined, {
              onSuccess: (result) => writeResult(result, "User sync"),
            });
          }}
        >
          <RefreshCw className="h-4 w-4" />
          User
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => {
            const id = requireInstallationID();
            if (!id) {
              return;
            }
            setNotice("");
            runInstallationSync.mutate(id, {
              onSuccess: (result) => writeResult(result, "Installation sync"),
            });
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Installation
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => {
            const normalizedRepository = requireRepository();
            const number = requireNumber();
            if (!normalizedRepository || !number) {
              return;
            }
            setNotice("");
            runPullRequestSync.mutate({ repository: normalizedRepository, number }, {
              onSuccess: (result) => writeResult(result, "Pull request sync"),
            });
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Pull request
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => {
            const normalizedRepository = requireRepository();
            const number = requireNumber();
            if (!normalizedRepository || !number) {
              return;
            }
            setNotice("");
            runReviewSync.mutate({ repository: normalizedRepository, number }, {
              onSuccess: (result) => writeResult(result, "Review sync"),
            });
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Review
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => {
            const normalizedRepository = requireRepository();
            const number = requireNumber();
            if (!normalizedRepository || !number) {
              return;
            }
            setNotice("");
            runIssueSync.mutate({ repository: normalizedRepository, number }, {
              onSuccess: (result) => writeResult(result, "Issue sync"),
            });
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Issue
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={pending}
          onClick={() => {
            const normalizedRepository = requireRepository();
            const sha = requireSHA();
            if (!normalizedRepository || !sha) {
              return;
            }
            setNotice("");
            runCommitSync.mutate({ repository: normalizedRepository, sha }, {
              onSuccess: (result) => writeResult(result, "Commit sync"),
            });
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Commit
        </Button>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-rose-200">{actionError}</p>
      ) : notice ? (
        <p className="text-sm text-muted">{notice}</p>
      ) : (
        <p className="text-sm text-muted">No sync execution run yet.</p>
      )}
    </div>
  );
}

function countSummary(label: string, values?: Record<string, number>): string {
  if (!values) {
    return "";
  }
  const total = Object.values(values).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  if (total <= 0) {
    return "";
  }
  return ` • ${label} ${total}`;
}
