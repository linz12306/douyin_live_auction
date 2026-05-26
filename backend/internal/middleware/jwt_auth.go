package middleware

import (
	"net/http"
	"strings"

	"douyin-live/backend/internal/config"
	pkgjwt "douyin-live/backend/pkg/jwt"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

func JWTAuth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "未提供认证令牌")
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := pkgjwt.ParseAccessToken(tokenStr, cfg.JWTSecret)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "令牌无效或已过期")
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}
