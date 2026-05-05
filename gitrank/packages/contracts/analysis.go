package contracts

type PullRequestAnalysisRequest struct {
	Repository  RepositoryContext  `json:"repository"`
	PullRequest PullRequestContext `json:"pull_request"`
}

type RepositoryContext struct {
	FullName        string `json:"full_name"`
	PrimaryLanguage string `json:"primary_language,omitempty"`
	DefaultBranch   string `json:"default_branch,omitempty"`
	Stars           int    `json:"stars,omitempty"`
	Maintainers     int    `json:"maintainers,omitempty"`
	Archived        bool   `json:"archived,omitempty"`
}

type PullRequestContext struct {
	Number       int            `json:"number"`
	Title        string         `json:"title"`
	Body         string         `json:"body,omitempty"`
	State        string         `json:"state,omitempty"`
	Merged       bool           `json:"merged"`
	Draft        bool           `json:"draft"`
	Additions    int            `json:"additions"`
	Deletions    int            `json:"deletions"`
	ChangedFiles int            `json:"changed_files"`
	Commits      int            `json:"commits"`
	Labels       []string       `json:"labels,omitempty"`
	LinkedIssues []string       `json:"linked_issues,omitempty"`
	Files        []ChangedFile  `json:"files,omitempty"`
	Reviews      []ReviewSignal `json:"reviews,omitempty"`
}

type ChangedFile struct {
	Path      string `json:"path"`
	Additions int    `json:"additions,omitempty"`
	Deletions int    `json:"deletions,omitempty"`
	Status    string `json:"status,omitempty"`
}

type ReviewSignal struct {
	State             string `json:"state"`
	AuthorAssociation string `json:"author_association,omitempty"`
}

type PullRequestAnalysisResponse struct {
	Category        string        `json:"category"`
	Summary         string        `json:"summary"`
	Confidence      float64       `json:"confidence"`
	TechnicalDepth  float64       `json:"technical_depth"`
	ReviewStrength  float64       `json:"review_strength"`
	Signals         []string      `json:"signals,omitempty"`
	Skills          []string      `json:"skills,omitempty"`
	Flags           []string      `json:"flags,omitempty"`
	FileBreakdown   FileBreakdown `json:"file_breakdown"`
	PromptSuggested bool          `json:"prompt_suggested,omitempty"`
}

type FileBreakdown struct {
	Docs   int `json:"docs"`
	Tests  int `json:"tests"`
	Source int `json:"source"`
	Infra  int `json:"infra"`
	Config int `json:"config"`
}
