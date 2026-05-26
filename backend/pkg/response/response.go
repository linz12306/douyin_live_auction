package response

import "github.com/gin-gonic/gin"

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func Success(c *gin.Context, status int, data interface{}) {
	c.JSON(status, Response{Code: status, Message: "ok", Data: data})
}

func Error(c *gin.Context, status int, message string) {
	c.JSON(status, Response{Code: status, Message: message, Data: nil})
}
