package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DBDSN                  string
	RedisAddr              string
	RedisPass              string
	RealtimeEventStreamKey string
	JWTSecret              string
	ServerPort             string
	AvatarDir              string
	ImageDir               string
	LiveMediaDir           string
	BidCommandStreamKey    string
	BidCommandGroup        string
	BidCommandConsumer     string
	BidCommandConcurrency  int
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		DBDSN:                  getEnv("DB_DSN", "root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&loc=Local&charset=utf8mb4"),
		RedisAddr:              getEnv("REDIS_ADDR", "127.0.0.1:16380"),
		RedisPass:              getEnv("REDIS_PASSWORD", ""),
		RealtimeEventStreamKey: getEnv("REALTIME_EVENT_STREAM_KEY", "auction_events"),
		JWTSecret:              getEnv("JWT_SECRET", "dev-secret-change-me"),
		ServerPort:             getEnv("SERVER_PORT", "8080"),
		AvatarDir:              getEnv("AVATAR_DIR", "./static/avatars"),
		ImageDir:               getEnv("IMAGE_DIR", "./static/images"),
		LiveMediaDir:           getEnv("LIVE_MEDIA_DIR", "./static/live-media"),
		BidCommandStreamKey:    getEnv("BID_COMMAND_STREAM_KEY", "auction_bid_commands"),
		BidCommandGroup:        getEnv("BID_COMMAND_GROUP", "auction_bid_command_workers"),
		BidCommandConsumer:     getEnv("BID_COMMAND_CONSUMER", "backend"),
		BidCommandConcurrency:  getEnvInt("BID_COMMAND_CONCURRENCY", 4),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			return parsed
		}
	}
	return fallback
}
