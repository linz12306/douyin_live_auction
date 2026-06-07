package handler

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/service"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ProductHandler struct {
	svc          *service.ProductService
	imageDir     string
	liveMediaDir string
}

func NewProductHandler(svc *service.ProductService, imageDir, liveMediaDir string) *ProductHandler {
	return &ProductHandler{svc: svc, imageDir: imageDir, liveMediaDir: liveMediaDir}
}

const (
	maxLiveImageBytes = 2 * 1024 * 1024
	maxLiveVideoBytes = 20 * 1024 * 1024
)

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
	previousURL, err := h.svc.Delete(merchantID, productID)
	if err != nil {
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
	h.removeLiveMediaFile(previousURL)
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

func (h *ProductHandler) UploadLiveMedia(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	productID := getInt64Param(c, "id")

	file, err := c.FormFile("media")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "请选择直播间素材")
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	mediaType, maxSize, ok := classifyLiveMedia(ext)
	if !ok {
		response.Error(c, http.StatusBadRequest, "仅支持 jpg/png/webp/mp4/webm 格式")
		return
	}
	if file.Size > maxSize {
		if mediaType == "video" {
			response.Error(c, http.StatusBadRequest, "视频大小不能超过20MB")
			return
		}
		response.Error(c, http.StatusBadRequest, "图片大小不能超过2MB")
		return
	}
	if !liveMediaContentMatches(mediaType, file) {
		response.Error(c, http.StatusBadRequest, "仅支持 jpg/png/webp/mp4/webm 格式")
		return
	}
	if err := h.svc.ValidateLiveMediaUpload(merchantID, productID, mediaType); err != nil {
		respondProductMutationError(c, err)
		return
	}

	if err := os.MkdirAll(h.liveMediaDir, 0755); err != nil {
		response.Error(c, http.StatusInternalServerError, "直播间素材上传失败")
		return
	}

	filename := fmt.Sprintf("live_%d_%d%s", productID, time.Now().UnixNano(), ext)
	savePath := filepath.Join(h.liveMediaDir, filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		response.Error(c, http.StatusInternalServerError, "直播间素材上传失败")
		return
	}

	media, previousURL, err := h.svc.ReplaceLiveMedia(merchantID, productID, mediaType, "/static/live-media/"+filename, nil)
	if err != nil {
		_ = os.Remove(savePath)
		respondProductMutationError(c, err)
		return
	}
	h.removeLiveMediaFile(previousURL)
	response.Success(c, http.StatusOK, media)
}

func (h *ProductHandler) DeleteLiveMedia(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	productID := getInt64Param(c, "id")

	previousURL, err := h.svc.DeleteLiveMedia(merchantID, productID)
	if err != nil {
		respondProductMutationError(c, err)
		return
	}
	h.removeLiveMediaFile(previousURL)
	response.Success(c, http.StatusOK, nil)
}

func classifyLiveMedia(ext string) (mediaType string, maxSize int64, ok bool) {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp":
		return "image", maxLiveImageBytes, true
	case ".mp4", ".webm":
		return "video", maxLiveVideoBytes, true
	default:
		return "", 0, false
	}
}

func liveMediaContentMatches(mediaType string, file *multipart.FileHeader) bool {
	if !liveMediaContentTypeMatches(mediaType, file.Header.Get("Content-Type")) {
		return false
	}
	opened, err := file.Open()
	if err != nil {
		return false
	}
	defer opened.Close()

	buffer := make([]byte, 512)
	n, err := opened.Read(buffer)
	if err != nil && err != io.EOF {
		return false
	}
	if n == 0 {
		return false
	}
	return liveMediaContentTypeMatches(mediaType, http.DetectContentType(buffer[:n]))
}

func liveMediaContentTypeMatches(mediaType, contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch mediaType {
	case "image":
		return contentType == "image/jpeg" || contentType == "image/png" || contentType == "image/webp"
	case "video":
		return contentType == "video/mp4" || contentType == "video/webm"
	default:
		return false
	}
}

func (h *ProductHandler) removeLiveMediaFile(mediaURL *string) {
	if mediaURL == nil {
		return
	}
	if path, ok := h.liveMediaPathForURL(*mediaURL); ok {
		_ = os.Remove(path)
	}
}

func (h *ProductHandler) liveMediaPathForURL(mediaURL string) (string, bool) {
	const prefix = "/static/live-media/"
	if !strings.HasPrefix(mediaURL, prefix) {
		return "", false
	}
	filename := strings.TrimPrefix(mediaURL, prefix)
	if filename == "" || filename != filepath.Base(filename) || strings.Contains(filename, "/") || strings.Contains(filename, `\`) {
		return "", false
	}
	return filepath.Join(h.liveMediaDir, filename), true
}

func respondProductMutationError(c *gin.Context, err error) {
	switch err {
	case service.ErrProductNotFound:
		response.Error(c, http.StatusNotFound, err.Error())
	case service.ErrNotOwner:
		response.Error(c, http.StatusForbidden, err.Error())
	case service.ErrStatusImmutable, service.ErrInvalidLiveMediaType:
		response.Error(c, http.StatusBadRequest, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "操作失败")
	}
}

func getInt64Param(c *gin.Context, name string) int64 {
	var v int64
	fmt.Sscanf(c.Param(name), "%d", &v)
	return v
}
