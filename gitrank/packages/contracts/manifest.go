package contracts

type ServiceManifest struct {
	Service      string           `json:"service"`
	Description  string           `json:"description"`
	Version      string           `json:"version"`
	Routes       []RouteSpec      `json:"routes"`
	Dependencies []DependencySpec `json:"dependencies,omitempty"`
}

type RouteSpec struct {
	Method  string `json:"method"`
	Path    string `json:"path"`
	Summary string `json:"summary"`
	Status  string `json:"status"`
}

type DependencySpec struct {
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	BaseURL  string `json:"base_url,omitempty"`
	Purpose  string `json:"purpose"`
	Auth     string `json:"auth,omitempty"`
	Critical bool   `json:"critical"`
	Status   string `json:"status"`
}
