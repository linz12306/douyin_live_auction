package service

import (
	"errors"
	"fmt"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/model"
	"douyin-live/backend/internal/repository"
)

var (
	ErrNotOwner        = errors.New("无权操作此商品")
	ErrStatusImmutable = errors.New("当前状态不允许此操作")
	ErrNeedAtLeastOne  = errors.New("至少保留一张图片")
	ErrImageLimit      = errors.New("图片不能超过9张")
	ErrProductNotFound = errors.New("商品不存在")
)

type ProductService struct {
	productRepo *repository.ProductRepo
	auctionRepo *repository.AuctionRepo
}

func NewProductService(productRepo *repository.ProductRepo, auctionRepo *repository.AuctionRepo) *ProductService {
	return &ProductService{productRepo: productRepo, auctionRepo: auctionRepo}
}

func (s *ProductService) Create(merchantID int64, req *dto.CreateProductRequest) (*dto.ProductDetailResponse, error) {
	if len(req.Title) == 0 || len(req.Title) > 200 {
		return nil, errors.New("商品标题为1-200字符")
	}
	if len(req.Description) > 5000 {
		return nil, errors.New("商品介绍不超过5000字符")
	}

	product := &model.Product{
		MerchantID:  merchantID,
		Title:       req.Title,
		Description: req.Description,
	}
	if err := s.productRepo.Create(product, req.ImageURLs); err != nil {
		return nil, fmt.Errorf("create product: %w", err)
	}

	images, _ := s.productRepo.FindImages(product.ID)
	return &dto.ProductDetailResponse{Product: *product, Images: images, Auction: nil}, nil
}

func (s *ProductService) Publish(merchantID, productID int64, req *dto.PublishRequest) (*dto.ProductDetailResponse, error) {
	product, err := s.productRepo.FindByID(productID)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, ErrProductNotFound
	}
	if product.MerchantID != merchantID {
		return nil, ErrNotOwner
	}
	if product.Status != "draft" {
		return nil, errors.New("仅草稿状态可以发布")
	}

	images, _ := s.productRepo.FindImages(productID)
	if len(images) == 0 {
		return nil, errors.New("至少需要一张商品图片")
	}

	if err := s.validateAuctionRules(req); err != nil {
		return nil, err
	}

	auction := &model.Auction{
		ProductID:         productID,
		MerchantID:        merchantID,
		StartPrice:        req.StartPrice,
		BidIncrementType:  req.BidIncrementType,
		BidIncrementValue: req.BidIncrementValue,
		CeilingPrice:      req.CeilingPrice,
		DurationSeconds:   req.DurationSeconds,
		AutoExtendSeconds: req.AutoExtendSeconds,
		MaxExtendCount:    req.MaxExtendCount,
	}
	if auction.AutoExtendSeconds == 0 {
		auction.AutoExtendSeconds = 15
	}
	if auction.MaxExtendCount == 0 {
		auction.MaxExtendCount = 5
	}

	if err := s.productRepo.UpdateStatus(productID, "pending"); err != nil {
		return nil, fmt.Errorf("update product status: %w", err)
	}
	if err := s.auctionRepo.Create(auction); err != nil {
		return nil, fmt.Errorf("create auction: %w", err)
	}
	s.auctionRepo.InsertLog(auction.ID, merchantID, "created",
		fmt.Sprintf(`{"title":"%s","start_price":%f}`, product.Title, req.StartPrice))

	product.Status = "pending"
	images, _ = s.productRepo.FindImages(productID)
	return &dto.ProductDetailResponse{Product: *product, Images: images, Auction: auction}, nil
}

func (s *ProductService) Get(productID int64) (*dto.ProductDetailResponse, error) {
	product, err := s.productRepo.FindByID(productID)
	if err != nil || product == nil {
		return nil, ErrProductNotFound
	}
	images, _ := s.productRepo.FindImages(productID)
	auction, _ := s.auctionRepo.FindByProductID(productID)
	return &dto.ProductDetailResponse{Product: *product, Images: images, Auction: auction}, nil
}

func (s *ProductService) List(merchantID int64, query *dto.ProductListQuery) ([]model.Product, int, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Size <= 0 || query.Size > 50 {
		query.Size = 20
	}
	return s.productRepo.ListByMerchant(merchantID, query.Status, query.Page, query.Size)
}

func (s *ProductService) ListAuctionLobby(query *dto.ProductListQuery) ([]dto.AuctionLobbyItem, int, error) {
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Size <= 0 || query.Size > 50 {
		query.Size = 20
	}
	if query.Status != "" && query.Status != "active" {
		return []dto.AuctionLobbyItem{}, 0, nil
	}
	return s.productRepo.ListAuctionLobby(query.Page, query.Size)
}

func (s *ProductService) Update(merchantID, productID int64, req *dto.UpdateProductRequest) (*dto.ProductDetailResponse, error) {
	product, err := s.productRepo.FindByID(productID)
	if err != nil || product == nil {
		return nil, ErrProductNotFound
	}
	if product.MerchantID != merchantID {
		return nil, ErrNotOwner
	}
	if product.Status != "draft" && product.Status != "pending" {
		return nil, ErrStatusImmutable
	}
	if len(req.Title) == 0 || len(req.Title) > 200 {
		return nil, errors.New("商品标题为1-200字符")
	}

	product.Title = req.Title
	product.Description = req.Description
	if err := s.productRepo.Update(product); err != nil {
		return nil, err
	}

	images, _ := s.productRepo.FindImages(productID)
	auction, _ := s.auctionRepo.FindByProductID(productID)
	return &dto.ProductDetailResponse{Product: *product, Images: images, Auction: auction}, nil
}

func (s *ProductService) Delete(merchantID, productID int64) error {
	product, err := s.productRepo.FindByID(productID)
	if err != nil || product == nil {
		return ErrProductNotFound
	}
	if product.MerchantID != merchantID {
		return ErrNotOwner
	}
	if product.Status != "draft" {
		return ErrStatusImmutable
	}
	return s.productRepo.Delete(productID)
}

func (s *ProductService) AddImage(merchantID, productID int64, url string) error {
	product, err := s.productRepo.FindByID(productID)
	if err != nil || product == nil {
		return ErrProductNotFound
	}
	if product.MerchantID != merchantID {
		return ErrNotOwner
	}
	if product.Status != "draft" && product.Status != "pending" {
		return ErrStatusImmutable
	}
	count, _ := s.productRepo.CountImages(productID)
	if count >= 9 {
		return ErrImageLimit
	}
	return s.productRepo.AddImage(productID, url)
}

func (s *ProductService) DeleteImage(merchantID, productID, imageID int64) error {
	product, err := s.productRepo.FindByID(productID)
	if err != nil || product == nil {
		return ErrProductNotFound
	}
	if product.MerchantID != merchantID {
		return ErrNotOwner
	}
	if product.Status != "draft" && product.Status != "pending" {
		return ErrStatusImmutable
	}
	count, _ := s.productRepo.CountImages(productID)
	if count <= 1 {
		return ErrNeedAtLeastOne
	}
	return s.productRepo.DeleteImage(imageID)
}

func (s *ProductService) validateAuctionRules(req *dto.PublishRequest) error {
	if req.BidIncrementType == "fixed" && req.BidIncrementValue < 1 {
		return errors.New("固定加价幅度不能小于1元")
	}
	if req.BidIncrementType == "percent" && (req.BidIncrementValue < 1 || req.BidIncrementValue > 20) {
		return errors.New("百分比加价幅度需在1-20之间")
	}
	if req.CeilingPrice != nil && *req.CeilingPrice <= req.StartPrice {
		return errors.New("封顶价必须大于起拍价")
	}
	validDurations := map[int]bool{60: true, 300: true, 1800: true}
	if !validDurations[req.DurationSeconds] {
		return errors.New("竞拍时长需为60/300/1800秒")
	}
	if req.AutoExtendSeconds != 0 && (req.AutoExtendSeconds < 10 || req.AutoExtendSeconds > 30) {
		return errors.New("延时时间需在10-30秒之间")
	}
	if req.MaxExtendCount != 0 && (req.MaxExtendCount < 1 || req.MaxExtendCount > 10) {
		return errors.New("最大延时次数需在1-10之间")
	}
	return nil
}
