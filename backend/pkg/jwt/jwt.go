package jwt

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type RefreshClaims struct {
	UserID int64  `json:"user_id"`
	JTI    string `json:"jti"`
	jwt.RegisteredClaims
}

func GenerateAccessToken(userID int64, username, role, secret string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func GenerateRefreshToken(userID int64, secret string) (token string, jti string, err error) {
	jti = uuid.New().String()
	claims := RefreshClaims{
		UserID: userID,
		JTI:    jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	return
}

func ParseAccessToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	return token.Claims.(*Claims), nil
}

func ParseRefreshToken(tokenStr, secret string) (*RefreshClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &RefreshClaims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	return token.Claims.(*RefreshClaims), nil
}
