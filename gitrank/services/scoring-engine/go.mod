module github.com/gitrank/gitrank/services/scoring-engine

go 1.26.3

require (
	github.com/gitrank/gitrank/packages/config v0.0.0
	github.com/gitrank/gitrank/packages/contracts v0.0.0
	github.com/gitrank/gitrank/packages/httpkit v0.0.0
	github.com/gitrank/gitrank/packages/logger v0.0.0
	github.com/jackc/pgx/v5 v5.10.0
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/text v0.29.0 // indirect
)

replace github.com/gitrank/gitrank/packages/config => ../../packages/config

replace github.com/gitrank/gitrank/packages/contracts => ../../packages/contracts

replace github.com/gitrank/gitrank/packages/logger => ../../packages/logger

replace github.com/gitrank/gitrank/packages/httpkit => ../../packages/httpkit
