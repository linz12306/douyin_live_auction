package config

import (
	"strings"
	"testing"

	"github.com/go-sql-driver/mysql"
)

func TestNormalizeMySQLDSNForcesUTCSession(t *testing.T) {
	dsn := "root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&loc=Local&charset=utf8mb4"

	normalized, err := normalizeMySQLDSN(dsn)
	if err != nil {
		t.Fatalf("normalizeMySQLDSN error = %v", err)
	}
	cfg, err := mysql.ParseDSN(normalized)
	if err != nil {
		t.Fatalf("ParseDSN normalized error = %v", err)
	}

	if !cfg.ParseTime {
		t.Fatal("expected parseTime to be forced on")
	}
	if cfg.Loc.String() != "UTC" {
		t.Fatalf("loc = %s, want UTC", cfg.Loc)
	}
	if cfg.Params["time_zone"] != "'+00:00'" {
		t.Fatalf("time_zone = %q, want '+00:00'", cfg.Params["time_zone"])
	}
	if !strings.Contains(normalized, "time_zone=%27%2B00%3A00%27") {
		t.Fatalf("normalized DSN does not include escaped UTC time_zone: %s", normalized)
	}
}
