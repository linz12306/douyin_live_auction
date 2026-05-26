package main

import (
	"fmt"
	"log"
	"time"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/handler"
	"douyin-live/backend/internal/middleware"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := config.NewDB(cfg.DBDSN)
	if err != nil {
		log.Fatalf("Failed to connect to MySQL: %v", err)
	}
	defer db.Close()

	rdb, err := config.NewRedis(cfg.RedisAddr, cfg.RedisPass)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer rdb.Close()

	// Repositories
	userRepo := repository.NewUserRepo(db)

	// Services
	authSvc := service.NewAuthService(userRepo, rdb, cfg)
	userSvc := service.NewUserService(userRepo)

	// Handlers
	authH := handler.NewAuthHandler(authSvc)
	userH := handler.NewUserHandler(userSvc, cfg.AvatarDir)

	// Router
	r := gin.Default()

	// Static file serving for avatars
	r.Static("/static/avatars", cfg.AvatarDir)

	api := r.Group("/api/v1")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register",
				middleware.RateLimit(rdb, "register", 10, time.Hour),
				authH.Register,
			)
			auth.POST("/login",
				middleware.RateLimit(rdb, "login", 5, time.Minute),
				authH.Login,
			)
			auth.POST("/refresh", authH.Refresh)
			auth.POST("/logout", authH.Logout)
		}

		// User routes (authenticated)
		users := api.Group("/users")
		users.Use(middleware.JWTAuth(cfg))
		{
			users.GET("/me", userH.GetMe)
			users.PUT("/me", userH.UpdateProfile)
			users.PUT("/me/password", userH.ChangePassword)
			users.POST("/me/avatar", userH.UploadAvatar)
			users.GET("/:id", userH.GetUser)
		}
	}

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
