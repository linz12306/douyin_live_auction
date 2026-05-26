package handler

import (
	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/model"
)

func userToResponse(user *model.User) dto.UserResponse {
	return dto.UserResponse{
		ID:           user.ID,
		Username:     user.Username,
		Role:         user.Role,
		DisplayName:  user.DisplayName,
		AvatarURL:    user.AvatarURL,
		Balance:      user.Balance,
		FrozenAmount: user.FrozenAmount,
	}
}
