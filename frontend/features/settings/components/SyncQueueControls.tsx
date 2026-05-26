"use client";

import { useState } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueueSyncRequest } from "@/hooks/use-account-actions";
import type { QueueSyncInput } from "@/lib/api/account-api";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

const QUEUE_MODES: Array<{ value: QueueSyncInput["mode"]; label: string }> = [
  { value: "user", label: "User" },
  { value: "installation", label: "Installation" },
  { value: "repository", label: "Repository" },
  { value: "pull_request", label: "Pull request" },
  { value: "review", label: "Review" },
  { value: "issue", label: "Issue" },
  { value: "commit", label: "Commit" },
];

export function SyncQueueControls() {
  const queueSync = useQueueSyncRequest();

  const [mode, setMode] = useState<QueueSyncInput["mode"]>("user");
  const [repository, setRepository] = useState("");
  const [userLogin, setUserLogin] = useState("");
  const [installationID, setInstallationID] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [shaInput, setSHAInput] = useState("");
  const [notice, setNotice] = useState("");

  const actionError = sanitizeUserFacingError(
    (queueSync.error as Error | null)?.message ?? "",
    "settings-sync-queue",
  );

  function parsePositiveInt(value: string): number | null {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  function queue() {
    const payload: QueueSyncInput = { mode };
    const normalizedRepository = repository.trim();
    const normalizedUser = userLogin.trim();
    const normalizedSHA = shaInput.trim();
    const parsedNumber = parsePositiveInt(numberInput);
    const parsedInstallationID = parsePositiveInt(installationID);

    if (mode === "user") {
      payload.user = normalizedUser || undefined;
    }

    if (mode === "installation") {
      if (!parsedInstallationID) {
        setNotice("Enter a positive installation ID.");
        return;
      }
      payload.installationId = parsedInstallationID;
    }

    if (mode === "repository" || mode === "pull_request" || mode === "review" || mode === "issue" || mode === "commit") {
      if (!normalizedRepository) {
        setNotice("Enter repository as owner/repo.");
        return;
      }
      payload.repository = normalizedRepository;
    }

    if (mode === "pull_request" || mode === "review" || mode === "issue") {
      if (!parsedNumber) {
        setNotice("Enter a positive PR/review/issue number.");
        return;
      }
      payload.number = parsedNumber;
    }

    if (mode === "commit") {
      if (!normalizedSHA) {
        setNotice("Enter commit SHA.");
        return;
      }
      payload.sha = normalizedSHA;
    }

    setNotice("");
    queueSync.mutate(payload, {
      onSuccess: (result) => {
        setNotice(
          `Queued ${mode} sync: ${result.status}${result.job_id ? ` • job ${result.job_id}` : ""}${result.correlation_id ? ` • correlation ${result.correlation_id}` : ""}`,
        );
      },
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-primary">Sync queue controls</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Queue backend sync jobs</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Sends queue requests to `/v1/sync` for installation, user, repository, PR, review, issue, or commit modes.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-medium text-primary" htmlFor="sync-queue-mode">
          Queue mode
        </label>
        <select
          id="sync-queue-mode"
          value={mode}
          onChange={(event) => setMode(event.target.value as QueueSyncInput["mode"])}
          className="focus-ring h-10 w-full rounded-[0.8rem] border border-primary/24 bg-card/80 px-3 text-sm text-white"
        >
          {QUEUE_MODES.map((option) => (
            <option key={option.value} value={option.value} className="bg-slate-900 text-white">
              {option.label}
            </option>
          ))}
        </select>
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
          placeholder="GitHub login"
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={queueSync.isPending}
          onClick={queue}
        >
          <Clock3 className="h-4 w-4" />
          {queueSync.isPending ? "Queueing..." : "Queue sync job"}
        </Button>
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-rose-200">{actionError}</p>
      ) : notice ? (
        <p className="text-sm text-muted">{notice}</p>
      ) : (
        <p className="text-sm text-muted">No queue action submitted yet.</p>
      )}
    </div>
  );
}
