package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/handler"
	"douyin-live/backend/internal/middleware"
	"douyin-live/backend/internal/realtime"
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

	// Product
	productRepo := repository.NewProductRepo(db)
	auctionRepo := repository.NewAuctionRepo(db)
	productSvc := service.NewProductService(productRepo, auctionRepo)
	productH := handler.NewProductHandler(productSvc, cfg.ImageDir)

	// Auction engine
	auctionEngineRepo := repository.NewAuctionEngineRepo(db)
	eventBus := realtime.NewInMemoryAuctionEventBus()
	snapshotProvider := realtime.NewSnapshotProvider(auctionEngineRepo)
	realtimeHub := realtime.NewHub(eventBus, snapshotProvider)
	go realtimeHub.Run(context.Background())
	auctionSvc := service.NewAuctionServiceWithEvents(auctionEngineRepo, rdb, eventBus)
	auctionH := handler.NewAuctionHandler(auctionSvc)
	realtimeH := handler.NewRealtimeHandler(realtimeHub, snapshotProvider, cfg)
	healthSvc := service.NewHealthService(db, rdb, service.EngineStatsProviderFunc(func() service.EngineStats {
		hubStats := realtimeHub.Stats()
		return service.EngineStats{
			ActiveRooms:      hubStats.ActiveRooms,
			ConnectedClients: hubStats.ConnectedClients,
			DroppedEvents:    eventBus.DroppedEvents(),
		}
	}))
	healthH := handler.NewHealthHandler(healthSvc)
	startAuctionSettlementWorker(auctionSvc)
	orderRepo := repository.NewOrderRepo(db)
	orderSvc := service.NewOrderService(orderRepo)
	orderH := handler.NewOrderHandler(orderSvc)
	startOrderTimeoutWorker(orderSvc)

	// Router
	r := gin.Default()

	r.GET("/healthz", healthH.Healthz)

	// Static file serving for avatars
	r.Static("/static/avatars", cfg.AvatarDir)
	r.Static("/static/images", cfg.ImageDir)

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

		// Product routes
		products := api.Group("/products")
		products.Use(middleware.JWTAuth(cfg))
		{
			products.GET("", productH.List)
			products.GET("/:id", productH.Get)
			products.POST("", middleware.RoleGuard("merchant"), productH.Create)
			products.PUT("/:id", middleware.RoleGuard("merchant"), productH.Update)
			products.DELETE("/:id", middleware.RoleGuard("merchant"), productH.Delete)
			products.POST("/:id/images", middleware.RoleGuard("merchant"), productH.UploadImage)
			products.DELETE("/:id/images/:image_id", middleware.RoleGuard("merchant"), productH.DeleteImage)
			products.POST("/:id/publish", middleware.RoleGuard("merchant"), productH.Publish)
		}

		// Auction routes
		auctions := api.Group("/auctions")
		auctions.Use(middleware.JWTAuth(cfg))
		{
			auctions.POST("/:id/bid", middleware.RoleGuard("user"), auctionH.PlaceBid)
			auctions.GET("/:id/rankings", auctionH.Rankings)
			auctions.POST("/:id/activate", middleware.RoleGuard("merchant"), auctionH.Activate)
			auctions.DELETE("/:id", middleware.RoleGuard("merchant"), auctionH.Cancel)
		}

		// Order routes
		orders := api.Group("/orders")
		orders.Use(middleware.JWTAuth(cfg))
		{
			orders.GET("", orderH.List)
			orders.GET("/:id", orderH.Get)
			orders.POST("/:id/confirm", middleware.RoleGuard("user"), orderH.Confirm)
			orders.POST("/:id/pay", middleware.RoleGuard("user"), orderH.Pay)
			orders.POST("/:id/cancel", middleware.RoleGuard("user"), orderH.Cancel)
		}
	}

	r.GET("/ws/auctions/:id", realtimeH.AuctionRoom)

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func startAuctionSettlementWorker(auctionSvc *service.AuctionService) {
	ticker := time.NewTicker(time.Second)
	go func() {
		for range ticker.C {
			if _, err := auctionSvc.SettleExpired(context.Background()); err != nil {
				log.Printf("auction settlement worker failed: %v", err)
			}
		}
	}()
}

func startOrderTimeoutWorker(orderSvc *service.OrderService) {
	ticker := time.NewTicker(time.Minute)
	go func() {
		for range ticker.C {
			if _, err := orderSvc.ExpirePendingConfirmOrders(context.Background(), time.Now()); err != nil {
				log.Printf("order timeout worker failed: %v", err)
			}
		}
	}()
}
