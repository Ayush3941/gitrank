package service

import (
	"bytes"
	"strings"
	"testing"
)

func TestCacheWritePrometheusIncludesHitRate(t *testing.T) {
	cache := &Cache{}
	cache.recordHit()
	cache.recordHit()
	cache.recordMiss()
	cache.recordWriteOK()
	cache.recordWriteError()

	var out bytes.Buffer
	cache.WritePrometheus(&out)
	text := out.String()

	for _, fragment := range []string{
		"gitrank_profile_cache_hits_total 2",
		"gitrank_profile_cache_misses_total 1",
		"gitrank_profile_cache_writes_total 1",
		"gitrank_profile_cache_write_errors_total 1",
		"gitrank_profile_cache_hit_rate 0.666667",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("metrics output missing %q: %s", fragment, text)
		}
	}
}
