module github.com/Ayush3941/gitrank/services/pr-analyzer

go 1.26.3

require (
	github.com/Ayush3941/gitrank/packages/config v0.0.0
	github.com/Ayush3941/gitrank/packages/contracts v0.0.0
	github.com/Ayush3941/gitrank/packages/httpkit v0.0.0
	github.com/Ayush3941/gitrank/packages/logger v0.0.0
)

replace github.com/Ayush3941/gitrank/packages/config => ../../packages/config

replace github.com/Ayush3941/gitrank/packages/contracts => ../../packages/contracts

replace github.com/Ayush3941/gitrank/packages/logger => ../../packages/logger

replace github.com/Ayush3941/gitrank/packages/httpkit => ../../packages/httpkit
