package handler

import (
	"context"
	"database/sql"
	"testing"
)

const mysqlTestLockName = "douyin_live_shared_test_db"

func acquireMySQLTestLock(t *testing.T, db *sql.DB) {
	t.Helper()

	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("acquire test db connection: %v", err)
	}

	var acquired sql.NullInt64
	if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK(?, 60)", mysqlTestLockName).Scan(&acquired); err != nil {
		_ = conn.Close()
		t.Fatalf("acquire test db lock: %v", err)
	}
	if !acquired.Valid || acquired.Int64 != 1 {
		_ = conn.Close()
		t.Fatalf("timed out acquiring test db lock")
	}

	t.Cleanup(func() {
		var released sql.NullInt64
		_ = conn.QueryRowContext(context.Background(), "SELECT RELEASE_LOCK(?)", mysqlTestLockName).Scan(&released)
		_ = conn.Close()
	})
}
