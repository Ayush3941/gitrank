module github.com/gitrank/gitrank/services/api-gateway

go 1.26.3

require (
	github.com/gitrank/gitrank/packages/authkit v0.0.0
	github.com/gitrank/gitrank/packages/config v0.0.0
	github.com/gitrank/gitrank/packages/contracts v0.0.0
	github.com/gitrank/gitrank/packages/httpkit v0.0.0
	github.com/gitrank/gitrank/packages/logger v0.0.0
)

replace github.com/gitrank/gitrank/packages/authkit => ../../packages/authkit

replace github.com/gitrank/gitrank/packages/config => ../../packages/config

replace github.com/gitrank/gitrank/packages/contracts => ../../packages/contracts

replace github.com/gitrank/gitrank/packages/logger => ../../packages/logger

replace github.com/gitrank/gitrank/packages/httpkit => ../../packages/httpkit
