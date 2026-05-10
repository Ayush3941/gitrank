#!/bin/sh
set -eu

violations=$(
	find . \
		-path './.gocache' -prune -o \
		-path './.tmp' -prune -o \
		-path './vendor' -prune -o \
		-name '*.go' -print |
	while IFS= read -r file; do
		case "$file" in
			*_test.go)
				continue
				;;
		esac
		if grep -Eq '"unsafe"|"reflect"|unsafe\.|unsafe.Pointer|reflect\.' "$file"; then
			printf '%s\n' "$file"
		fi
	done
)

if [ -n "$violations" ]; then
	printf 'unsafe or reflection-heavy non-test Go code requires explicit security review:\n%s\n' "$violations" >&2
	exit 1
fi

printf 'go safety audit passed: no unsafe or reflection-heavy non-test Go code found\n'
