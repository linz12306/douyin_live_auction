package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBDSN      string
	RedisAddr  string
	RedisPass  string
	JWTSecret  string
	ServerPort string
	AvatarDir  string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		DBDSN:      getEnv("DB_DSN", "root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&charset=utf8mb4"),
		RedisAddr:  getEnv("REDIS_ADDR", "127.0.0.1:16379"),
		RedisPass:  getEnv("REDIS_PASSWORD", ""),
		JWTSecret:  getEnv("JWT_SECRET", "dev-secret-change-me"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
		AvatarDir:  getEnv("AVATAR_DIR", "./static/avatars"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
