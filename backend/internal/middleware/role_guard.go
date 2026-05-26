package middleware

import (
	"net/http"

	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

func RoleGuard(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := c.GetString("role")
		for _, r := range allowedRoles {
			if r == role {
				c.Next()
				return
			}
		}
		response.Error(c, http.StatusForbidden, "无权访问")
		c.Abort()
	}
}
