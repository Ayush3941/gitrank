module github.com/Ayush3941/gitrank/packages/store

go 1.26.2

require (
	github.com/Ayush3941/gitrank/packages/contracts v0.0.0
	github.com/jackc/pgx/v5 v5.7.6
)

replace github.com/Ayush3941/gitrank/packages/contracts => ../contracts
