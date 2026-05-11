package httpapi

import (
	"fmt"

	"github.com/Ayush3941/gitrank/packages/config"
	"github.com/Ayush3941/gitrank/packages/contracts"
)

type analysisLimitError struct {
	code    string
	message string
}

func (e analysisLimitError) Error() string {
	return e.message
}

func enforceAnalysisLimits(req contracts.PullRequestAnalysisRequest, limits config.AI) error {
	if req.PullRequest.ChangedFiles > limits.PRMaxChangedFiles {
		return analysisLimitError{
			code:    "changed_files_limit_exceeded",
			message: fmt.Sprintf("pull request changed_files %d exceeds limit %d", req.PullRequest.ChangedFiles, limits.PRMaxChangedFiles),
		}
	}
	if len(req.PullRequest.Files) > limits.PRMaxFileRecords {
		return analysisLimitError{
			code:    "file_records_limit_exceeded",
			message: fmt.Sprintf("pull request file records %d exceeds limit %d", len(req.PullRequest.Files), limits.PRMaxFileRecords),
		}
	}
	diffLines := req.PullRequest.Additions + req.PullRequest.Deletions
	if diffLines > limits.PRMaxDiffLines {
		return analysisLimitError{
			code:    "diff_lines_limit_exceeded",
			message: fmt.Sprintf("pull request diff lines %d exceeds limit %d", diffLines, limits.PRMaxDiffLines),
		}
	}
	inputChars := analysisInputCharacters(req)
	if inputChars > limits.PRMaxInputChars {
		return analysisLimitError{
			code:    "input_chars_limit_exceeded",
			message: fmt.Sprintf("analysis input characters %d exceeds limit %d", inputChars, limits.PRMaxInputChars),
		}
	}
	inputTokens := int(estimateTokens(inputChars))
	if inputTokens > limits.PRMaxEstimatedTokens {
		return analysisLimitError{
			code:    "estimated_tokens_limit_exceeded",
			message: fmt.Sprintf("estimated input tokens %d exceeds limit %d", inputTokens, limits.PRMaxEstimatedTokens),
		}
	}
	estimatedCostUSD := float64(inputTokens) * limits.EstimatedInputTokenCostUSD
	if estimatedCostUSD > limits.PRMaxEstimatedCostUSD {
		return analysisLimitError{
			code:    "estimated_cost_limit_exceeded",
			message: fmt.Sprintf("estimated input cost %.6f USD exceeds limit %.6f USD", estimatedCostUSD, limits.PRMaxEstimatedCostUSD),
		}
	}
	return nil
}
