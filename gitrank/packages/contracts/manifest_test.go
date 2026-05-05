package contracts

import "testing"

func TestServiceManifestFields(t *testing.T) {
	manifest := ServiceManifest{
		Service:     "api-gateway",
		Description: "edge API",
		Version:     "dev",
		Routes: []RouteSpec{
			{Method: "GET", Path: "/healthz", Summary: "health", Status: "implemented"},
		},
	}

	if manifest.Service != "api-gateway" {
		t.Fatalf("Service = %q, want api-gateway", manifest.Service)
	}
	if len(manifest.Routes) != 1 {
		t.Fatalf("Routes length = %d, want 1", len(manifest.Routes))
	}
}
