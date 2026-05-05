package githubapi

import (
	"strings"
)

type GraphQLPageInfo struct {
	EndCursor       string `json:"endCursor"`
	HasNextPage     bool   `json:"hasNextPage"`
	StartCursor     string `json:"startCursor,omitempty"`
	HasPreviousPage bool   `json:"hasPreviousPage,omitempty"`
}

func ParseLinkHeader(header string) map[string]string {
	links := make(map[string]string)
	for _, part := range strings.Split(header, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		segments := strings.Split(part, ";")
		if len(segments) < 2 {
			continue
		}
		target := strings.TrimSpace(segments[0])
		target = strings.TrimPrefix(target, "<")
		target = strings.TrimSuffix(target, ">")

		for _, segment := range segments[1:] {
			segment = strings.TrimSpace(segment)
			if !strings.HasPrefix(segment, "rel=") {
				continue
			}
			rel := strings.Trim(strings.TrimPrefix(segment, "rel="), `"`)
			if rel != "" {
				links[rel] = target
			}
		}
	}
	return links
}
