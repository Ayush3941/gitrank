package authkit

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestServiceReadSignature(t *testing.T) {
	now := time.Now().UTC()
	secret := []byte("service-read-test-secret")
	newRequest := func() *http.Request {
		request := httptest.NewRequest(http.MethodGet, "/internal/v1/pr/octo/repo/7/report", nil)
		if err := SignServiceReadRequest(request, secret, now); err != nil {
			t.Fatal(err)
		}
		return request
	}
	if err := VerifyServiceReadRequest(newRequest(), [][]byte{[]byte("next-secret"), secret}, now); err != nil {
		t.Fatalf("valid retiring key: %v", err)
	}
	for _, scenario := range []struct {
		name   string
		mutate func(*http.Request)
		at     time.Time
	}{
		{"missing signature", func(r *http.Request) { r.Header.Del(ServiceReadSignatureHeader) }, now},
		{"different path", func(r *http.Request) { r.URL.Path += "/other" }, now},
		{"different query", func(r *http.Request) { r.URL.RawQuery = "private=true" }, now},
		{"different method", func(r *http.Request) { r.Method = http.MethodPost }, now},
		{"expired", func(*http.Request) {}, now.Add(2 * time.Minute)},
		{"future", func(*http.Request) {}, now.Add(-2 * time.Minute)},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			request := newRequest()
			scenario.mutate(request)
			if err := VerifyServiceReadRequest(request, [][]byte{secret}, scenario.at); err == nil {
				t.Fatal("accepted invalid service request")
			}
		})
	}
	if err := VerifyServiceReadRequest(newRequest(), [][]byte{[]byte("wrong-secret")}, now); err == nil {
		t.Fatal("accepted wrong signing key")
	}
	if err := SignServiceReadRequest(newRequest(), nil, now); err == nil {
		t.Fatal("signed without a secret")
	}
}
