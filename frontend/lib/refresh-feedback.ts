export type RefreshFeedbackTone = "success" | "warning" | "error";

export type RefreshFeedback = {
  message: string;
  tone?: RefreshFeedbackTone;
};
