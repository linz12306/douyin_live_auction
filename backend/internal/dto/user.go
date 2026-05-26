package dto

type UpdateProfileRequest struct {
	DisplayName string `json:"display_name" binding:"required"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

type UserResponse struct {
	ID           int64   `json:"id"`
	Username     string  `json:"username"`
	Role         string  `json:"role"`
	DisplayName  string  `json:"display_name"`
	AvatarURL    string  `json:"avatar_url"`
	Balance      float64 `json:"balance"`
	FrozenAmount float64 `json:"frozen_amount"`
}
