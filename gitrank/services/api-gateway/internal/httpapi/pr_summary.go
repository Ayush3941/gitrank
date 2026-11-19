package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gitrank/gitrank/packages/contracts"
	"github.com/gitrank/gitrank/packages/httpkit"
)

func validPullRequestSummaryPath(path string) bool {
	return strings.HasSuffix(path, "/summary") && validPullRequestReportPath(strings.TrimSuffix(path, "/summary")+"/report")
}

func handlePullRequestSummary(w http.ResponseWriter, r *http.Request, client *http.Client, profileBaseURL, analyzerBaseURL string) {
	w.Header().Set("Cache-Control", "private, no-store")
	reportPath := strings.TrimSuffix(r.URL.Path, "/summary") + "/report"
	target, err := buildProxyURL(profileBaseURL, reportPath, "")
	if err != nil {
		httpkit.WriteError(w, http.StatusBadGateway, "report_unavailable", "PR evidence is unavailable.", httpkit.RequestIDFromContext(r.Context()))
		return
	}
	accessRequest, err := http.NewRequestWithContext(r.Context(), http.MethodGet, target, nil)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadGateway, "report_unavailable", "PR evidence is unavailable.", httpkit.RequestIDFromContext(r.Context()))
		return
	}
	for name, value := range defaultForwardHeaders(r) {
		copyHeaderIfPresent(accessRequest.Header, name, value)
	}
	accessRequest.Header.Set("X-Request-ID", httpkit.RequestIDFromContext(r.Context()))
	httpkit.InjectTraceContext(r.Context(), accessRequest.Header)
	access, err := client.Do(accessRequest)
	if err != nil {
		httpkit.WriteError(w, http.StatusBadGateway, "report_unavailable", "PR evidence is unavailable.", httpkit.RequestIDFromContext(r.Context()))
		return
	}
	defer access.Body.Close()
	if access.StatusCode != http.StatusOK {
		copyResponseHeaders(w.Header(), access.Header)
		w.WriteHeader(access.StatusCode)
		_, _ = io.Copy(w, io.LimitReader(access.Body, 128<<10))
		return
	}
	var report contracts.PullRequestReportResponse
	if err := json.NewDecoder(io.LimitReader(access.Body, 128<<10)).Decode(&report); err != nil {
		httpkit.WriteError(w, http.StatusBadGateway, "report_unavailable", "PR evidence is unavailable.", httpkit.RequestIDFromContext(r.Context()))
		return
	}
	if report.AISummaryVisible != nil && !*report.AISummaryVisible {
		httpkit.WriteError(w, http.StatusForbidden, "summary_hidden", "AI explanations are disabled for this report.", httpkit.RequestIDFromContext(r.Context()))
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/pr/"), "/")
	number, _ := strconv.Atoi(parts[2])
	body, _ := json.Marshal(contracts.SyncRequest{Repository: parts[0] + "/" + parts[1], Number: number})
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	headers := defaultForwardHeaders(r)
	headers["Content-Type"] = "application/json"
	proxyRequest(w, r, client, analyzerBaseURL, "/v1/analyze/pull-request/summary", proxyOptions{
		StreamResponse: true, ForwardHeaders: headers,
		ResponseHeaders: map[string]string{"Cache-Control": "private, no-store"},
	})
}
