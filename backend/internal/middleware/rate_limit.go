package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func RateLimit(rdb *redis.Client, action string, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		key := fmt.Sprintf("rate_limit:%s:%s", action, ip)

		count, err := rdb.Incr(context.Background(), key).Result()
		if err != nil {
			c.Next() // Redis down -> allow through (degraded mode)
			return
		}

		if count == 1 {
			rdb.Expire(context.Background(), key, window)
		}

		if count > int64(limit) {
			response.Error(c, http.StatusTooManyRequests, "请求过于频繁，请稍后再试")
			c.Abort()
			return
		}

		c.Next()
	}
}
