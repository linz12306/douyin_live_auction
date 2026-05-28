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

type ProductHandler struct {
	svc      *service.ProductService
	imageDir string
}

func NewProductHandler(svc *service.ProductService, imageDir string) *ProductHandler {
	return &ProductHandler{svc: svc, imageDir: imageDir}
}

func (h *ProductHandler) Create(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	var req dto.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	result, err := h.svc.Create(merchantID, &req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, http.StatusCreated, result)
}

func (h *ProductHandler) Publish(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	productID := getInt64Param(c, "id")

	var req dto.PublishRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	result, err := h.svc.Publish(merchantID, productID, &req)
	if err != nil {
		switch err {
		case service.ErrProductNotFound:
			response.Error(c, http.StatusNotFound, err.Error())
		case service.ErrNotOwner:
			response.Error(c, http.StatusForbidden, err.Error())
		default:
			response.Error(c, http.StatusBadRequest, err.Error())
		}
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *ProductHandler) Get(c *gin.Context) {
	productID := getInt64Param(c, "id")
	result, err := h.svc.Get(productID)
	if err != nil {
		response.Error(c, http.StatusNotFound, err.Error())
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *ProductHandler) List(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	role := c.GetString("role")
	var query dto.ProductListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.Error(c, http.StatusBadRequest, "参数格式错误")
		return
	}
	if role == "user" {
		items, total, err := h.svc.ListAuctionLobby(&query)
		if err != nil {
			response.Error(c, http.StatusInternalServerError, "获取列表失败")
			return
		}
		response.Success(c, http.StatusOK, gin.H{
			"items": items, "total": total, "page": query.Page, "size": query.Size,
		})
		return
	}

	products, total, err := h.svc.List(merchantID, &query)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取列表失败")
		return
	}
	response.Success(c, http.StatusOK, gin.H{
		"items": products, "total": total, "page": query.Page, "size": query.Size,
	})
}

func (h *ProductHandler) Update(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	productID := getInt64Param(c, "id")
	var req dto.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	result, err := h.svc.Update(merchantID, productID, &req)
	if err != nil {
		switch err {
		case service.ErrProductNotFound:
			response.Error(c, http.StatusNotFound, err.Error())
		case service.ErrNotOwner:
			response.Error(c, http.StatusForbidden, err.Error())
		case service.ErrStatusImmutable:
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusBadRequest, err.Error())
		}
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *ProductHandler) Delete(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	productID := getInt64Param(c, "id")
	if err := h.svc.Delete(merchantID, productID); err != nil {
		switch err {
		case service.ErrProductNotFound:
			response.Error(c, http.StatusNotFound, err.Error())
		case service.ErrNotOwner:
			response.Error(c, http.StatusForbidden, err.Error())
		case service.ErrStatusImmutable:
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, "删除失败")
		}
		return
	}
	response.Success(c, http.StatusOK, nil)
}

func (h *ProductHandler) UploadImage(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	productID := getInt64Param(c, "id")

	file, err := c.FormFile("image")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "请选择图片文件")
		return
	}
	ext := filepath.Ext(file.Filename)
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		response.Error(c, http.StatusBadRequest, "仅支持 jpg/png/webp 格式")
		return
	}
	if file.Size > 2*1024*1024 {
		response.Error(c, http.StatusBadRequest, "图片大小不能超过2MB")
		return
	}

	filename := fmt.Sprintf("prod_%d_%d%s", productID, time.Now().UnixNano(), ext)
	savePath := filepath.Join(h.imageDir, filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		response.Error(c, http.StatusInternalServerError, "图片上传失败")
		return
	}

	imageURL := "/static/images/" + filename
	if err := h.svc.AddImage(merchantID, productID, imageURL); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, http.StatusOK, gin.H{"image_url": imageURL})
}

func (h *ProductHandler) DeleteImage(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	productID := getInt64Param(c, "id")
	imageID := getInt64Param(c, "image_id")

	if err := h.svc.DeleteImage(merchantID, productID, imageID); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	response.Success(c, http.StatusOK, nil)
}

func getInt64Param(c *gin.Context, name string) int64 {
	var v int64
	fmt.Sscanf(c.Param(name), "%d", &v)
	return v
}
