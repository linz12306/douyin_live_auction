package handler

import (
	"fmt"
	"net/http"
	"path/filepath"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/service"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	svc       *service.UserService
	avatarDir string
}

func NewUserHandler(svc *service.UserService, avatarDir string) *UserHandler {
	return &UserHandler{svc: svc, avatarDir: avatarDir}
}

func (h *UserHandler) GetMe(c *gin.Context) {
	userID := c.GetInt64("user_id")
	user, err := h.svc.GetProfile(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取用户信息失败")
		return
	}
	response.Success(c, http.StatusOK, userToResponse(user))
}

func (h *UserHandler) GetUser(c *gin.Context) {
	var uri struct {
		ID int64 `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		response.Error(c, http.StatusBadRequest, "参数错误")
		return
	}
	user, err := h.svc.GetPublicProfile(uri.ID)
	if err != nil {
		response.Error(c, http.StatusNotFound, "用户不存在")
		return
	}
	response.Success(c, http.StatusOK, gin.H{
		"id":           user.ID,
		"username":     user.Username,
		"role":         user.Role,
		"display_name": user.DisplayName,
		"avatar_url":   user.AvatarURL,
	})
}

func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetInt64("user_id")
	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	if err := h.svc.UpdateProfile(userID, &req); err != nil {
		if err == service.ErrInvalidDisplayName {
			response.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, "更新失败")
		return
	}
	response.Success(c, http.StatusOK, nil)
}

func (h *UserHandler) ChangePassword(c *gin.Context) {
	userID := c.GetInt64("user_id")
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	if err := h.svc.ChangePassword(userID, &req); err != nil {
		switch err {
		case service.ErrWrongPassword:
			response.Error(c, http.StatusBadRequest, err.Error())
		case service.ErrPasswordTooShort:
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, "修改密码失败")
		}
		return
	}
	response.Success(c, http.StatusOK, nil)
}

func (h *UserHandler) UploadAvatar(c *gin.Context) {
	userID := c.GetInt64("user_id")

	file, err := c.FormFile("avatar")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "请选择头像文件")
		return
	}

	ext := filepath.Ext(file.Filename)
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		response.Error(c, http.StatusBadRequest, "仅支持 jpg/png/webp 格式")
		return
	}

	if file.Size > 2*1024*1024 {
		response.Error(c, http.StatusBadRequest, "头像大小不能超过2MB")
		return
	}

	filename := fmt.Sprintf("%d_%d%s", userID, time.Now().Unix(), ext)
	savePath := filepath.Join(h.avatarDir, filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		response.Error(c, http.StatusInternalServerError, "头像上传失败")
		return
	}

	avatarURL := "/static/avatars/" + filename
	if err := h.svc.UpdateAvatar(userID, avatarURL); err != nil {
		response.Error(c, http.StatusInternalServerError, "保存头像信息失败")
		return
	}

	response.Success(c, http.StatusOK, gin.H{"avatar_url": avatarURL})
}
