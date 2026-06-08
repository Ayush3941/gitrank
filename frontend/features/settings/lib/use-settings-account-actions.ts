"use client";

import { useEffect, useState } from "react";
import {
  useDeleteMyAccount,
  useExportMyAccountData,
  useLogoutSession,
  useRunUserSync,
  useStartAccountLink,
  useUnlinkMyAccount,
} from "@/hooks/use-account-actions";
import {
  buildAccountExportFilename,
  downloadJSON,
} from "@/features/settings/lib/settings-account-export";
import { buildUserSyncRefreshFeedback } from "@/lib/sync-refresh-feedback";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

type SettingsAccountNoticeVariant = "info" | "success" | "warning" | "error";

type RefetchAction = () => void | Promise<unknown>;

export function useSettingsAccountActions({
  username,
  appInstallationBlocked,
  isFetchingProfile,
  refetchProfile,
  refetchSyncRuns,
}: {
  username: string;
  appInstallationBlocked: boolean;
  isFetchingProfile: boolean;
  refetchProfile: RefetchAction;
  refetchSyncRuns: RefetchAction;
}) {
  const unlinkAccount = useUnlinkMyAccount();
  const deleteAccount = useDeleteMyAccount();
  const exportAccount = useExportMyAccountData();
  const logoutSession = useLogoutSession();
  const accountLinkStart = useStartAccountLink();
  const runUserSync = useRunUserSync();
  const [actionNotice, setActionNotice] = useState("");
  const [actionNoticeVariant, setActionNoticeVariant] =
    useState<SettingsAccountNoticeVariant>("info");
  const isActing =
    logoutSession.isPending ||
    runUserSync.isPending ||
    unlinkAccount.isPending ||
    deleteAccount.isPending ||
    exportAccount.isPending ||
    accountLinkStart.isPending;
  const actionError = sanitizeUserFacingError(
    (runUserSync.error as Error | null)?.message ||
      (logoutSession.error as Error | null)?.message ||
      (unlinkAccount.error as Error | null)?.message ||
      (deleteAccount.error as Error | null)?.message ||
      (exportAccount.error as Error | null)?.message ||
      (accountLinkStart.error as Error | null)?.message ||
      "",
    "settings-account-actions",
  );

  useEffect(() => {
    if (!actionNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActionNotice("");
    }, 4200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [actionNotice]);

  return {
    actionError,
    actionNotice,
    actionNoticeVariant,
    isActing,
    isUserSyncPending: runUserSync.isPending,
    isRelinkPending: accountLinkStart.isPending,
    isLogoutPending: logoutSession.isPending,
    isUnlinkPending: unlinkAccount.isPending,
    isExportPending: exportAccount.isPending,
    isDeletePending: deleteAccount.isPending,
    clearActionNotice: () => {
      setActionNotice("");
      setActionNoticeVariant("info");
    },
    refreshProfile: () => {
      if (appInstallationBlocked || isActing || isFetchingProfile) {
        return;
      }
      setActionNotice("");
      setActionNoticeVariant("info");
      runUserSync.mutate(undefined, {
        onSuccess: (result) => {
          const feedback = buildUserSyncRefreshFeedback(result);
          setActionNotice(feedback.message);
          setActionNoticeVariant(
            feedback.tone === "success"
              ? "success"
              : feedback.tone === "error"
                ? "error"
                : "warning",
          );
          void refetchProfile();
          void refetchSyncRuns();
        },
      });
    },
    reconnectGitHub: () => {
      if (isActing) {
        return;
      }
      setActionNotice("");
      setActionNoticeVariant("info");
      accountLinkStart.mutate("/dashboard/settings", {
        onSuccess: (result) => {
          if (!result.authorize_url) {
            setActionNotice("Account relink response is missing authorize_url.");
            setActionNoticeVariant("warning");
            return;
          }
          window.location.assign(result.authorize_url);
        },
      });
    },
    signOut: () => {
      if (isActing) {
        return;
      }
      setActionNotice("");
      setActionNoticeVariant("info");
      logoutSession.mutate(undefined, {
        onSuccess: () => {
          window.location.assign("/login");
        },
      });
    },
    disconnectGitHub: () => {
      if (isActing) {
        return;
      }
      if (!window.confirm("Disconnect GitHub and sign out of this GitRank session?")) {
        return;
      }
      setActionNotice("");
      setActionNoticeVariant("info");
      unlinkAccount.mutate(undefined, {
        onSuccess: () => {
          window.location.assign("/login");
        },
      });
    },
    exportAccountData: () => {
      if (isActing) {
        return;
      }
      setActionNotice("");
      setActionNoticeVariant("info");
      exportAccount.mutate(undefined, {
        onSuccess: (payload) => {
          downloadJSON(payload, buildAccountExportFilename(payload, username));
          setActionNotice(
            "Account export generated. Token secrets and secret hashes are excluded from the file.",
          );
          setActionNoticeVariant("success");
        },
      });
    },
    deleteAccount: () => {
      if (isActing) {
        return;
      }
      if (
        !window.confirm(
          "Delete this GitRank account? This removes your user-owned profile, score, badge, and session data from GitRank.",
        )
      ) {
        return;
      }
      setActionNotice("");
      setActionNoticeVariant("info");
      deleteAccount.mutate(undefined, {
        onSuccess: () => {
          window.location.assign("/");
        },
      });
    },
  };
}
