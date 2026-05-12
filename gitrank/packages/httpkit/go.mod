module github.com/gitrank/gitrank/packages/httpkit

go 1.26.3

require (
	github.com/gitrank/gitrank/packages/contracts v0.0.0
	github.com/gitrank/gitrank/packages/tracekit v0.0.0
)

replace github.com/gitrank/gitrank/packages/contracts => ../contracts

replace github.com/gitrank/gitrank/packages/tracekit => ../tracekit
