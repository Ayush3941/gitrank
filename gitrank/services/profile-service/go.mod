module github.com/Ayush3941/gitrank/services/profile-service

go 1.26.3

require (
	github.com/Ayush3941/gitrank/packages/authkit v0.0.0
	github.com/Ayush3941/gitrank/packages/config v0.0.0
	github.com/Ayush3941/gitrank/packages/contracts v0.0.0
	github.com/Ayush3941/gitrank/packages/httpkit v0.0.0
	github.com/Ayush3941/gitrank/packages/logger v0.0.0
	github.com/jackc/pgx/v5 v5.9.0
	github.com/redis/go-redis/v9 v9.17.0
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/text v0.29.0 // indirect
)

replace github.com/Ayush3941/gitrank/packages/authkit => ../../packages/authkit

replace github.com/Ayush3941/gitrank/packages/config => ../../packages/config

replace github.com/Ayush3941/gitrank/packages/contracts => ../../packages/contracts

replace github.com/Ayush3941/gitrank/packages/logger => ../../packages/logger

replace github.com/Ayush3941/gitrank/packages/httpkit => ../../packages/httpkit
