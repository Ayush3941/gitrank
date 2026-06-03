import { runAccessibleNameCheck } from "./lib/jsx-accessible-name-check.mjs";

runAccessibleNameCheck({
  checkLabel: "Select",
  tagNames: ["select"],
  failureMessage:
    "Native selects must expose an accessible name through aria-label, aria-labelledby, a title, or an id wired to a label.",
  successMessage: "Select accessible-name check passed",
});
