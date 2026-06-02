import { runAccessibleNameCheck } from "./lib/jsx-accessible-name-check.mjs";

runAccessibleNameCheck({
  checkLabel: "Input",
  tagNames: ["input", "Input"],
  ignoredFiles: ["components/ui/input.tsx"],
  failureMessage:
    "Inputs must expose an accessible name through aria-label, aria-labelledby, a title, or an id wired to a label. Do not rely on placeholder text.",
  successMessage: "Input accessible-name check passed",
});
