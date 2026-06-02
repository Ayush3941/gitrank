import { runAccessibleNameCheck } from "./lib/jsx-accessible-name-check.mjs";

runAccessibleNameCheck({
  checkLabel: "Switch",
  tagNames: ["Switch"],
  ignoredFiles: ["components/ui/switch.tsx"],
  failureMessage:
    "Switch controls must expose an accessible name through aria-label, aria-labelledby, a title, or an id wired to a label.",
  successMessage: "Switch accessible-name check passed",
});
