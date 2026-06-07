# Merchant Live Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let merchants configure one image or short video as the buyer live-room scene while keeping product gallery images, bidding, orders, and wallet semantics unchanged.

**Architecture:** Add a separate one-row-per-product `product_live_media` model and merchant-scoped upload/delete API. Extend product detail and realtime snapshot DTOs with an optional `live_media` object, then render it in `LiveAuctionRoom` before falling back to the current staged scene. Keep `product_images` as the source for lobby/order/dashboard summary imagery.

**Tech Stack:** Go 1.24 + Gin + MySQL migrations + local static files; React 19 + TypeScript + Vite + TailwindCSS + Vitest Testing Library; OpenSpec + Superpowers.

---

## Execution Status

- [x] Backend schema/repository/product detail support implemented.
- [x] Backend live media upload/replace/delete/static serving implemented with ownership, status, type, extension, content, size, and filesystem cleanup guards.
- [x] Realtime snapshot contract includes optional `product.live_media`.
- [x] Merchant `ProductForm` includes live media preview, upload, replace, delete, readonly, and validation states.
- [x] Buyer `LiveAuctionRoom` renders live video/image media ahead of the fallback staged scene.
- [x] Demo seed uploads a real live media file through the merchant API while keeping product gallery images as summary imagery.
- [x] Lobby and order summary image regressions verify `product_images` remain the summary source.
- [x] Focused backend and frontend tests passed for implemented slices.
- [x] Manual browser preview for `demo_merchant / test123` and `demo_buyer_a / test123`.
- [x] Final build/OpenSpec/diff verification.
- [x] Memory update.
- [ ] Commit and push after explicit user confirmation.

---

## File Map

- Create: `backend/migrations/008_create_product_live_media.sql`
  - Defines one live-room media asset per product.
- Modify: `backend/internal/config/config.go`
  - Adds `LiveMediaDir`.
- Modify: `backend/cmd/server/main.go`
  - Creates handler with live media dir and serves `/static/live-media`.
- Modify: `backend/internal/model/product_live_media.go`
  - New model for live media response and DB scans.
- Modify: `backend/internal/dto/product.go`
  - Adds `LiveMedia` to product detail response.
- Modify: `backend/internal/repository/product_repo.go`
  - Adds live media find/upsert/delete methods.
- Modify: `backend/internal/service/product_service.go`
  - Adds ownership/status guards and live media mutation methods.
- Modify: `backend/internal/handler/product_handler.go`
  - Adds live media upload/delete endpoints and validation.
- Modify: `backend/internal/repository/auction_engine_repo.go`
  - Loads live media into auction snapshot rows.
- Modify: `backend/internal/realtime/message.go`
  - Adds optional live media to realtime `ProductSummary`.
- Modify: `backend/internal/realtime/snapshot.go`
  - Includes live media in snapshot payload.
- Modify: `backend/tests/integration/product_test.go`
  - Adds API/product detail/lobby summary tests.
- Modify: `backend/internal/handler/realtime_handler_test.go`
  - Adds snapshot live media test.
- Modify: `frontend/src/types/product.ts`
  - Adds `ProductLiveMedia`.
- Modify: `frontend/src/types/auction.ts`
  - Adds optional `live_media` on product summary.
- Modify: `frontend/src/api/product.ts`
  - Adds upload/delete live media helpers.
- Modify: `frontend/src/pages/merchant/ProductForm.tsx`
  - Adds `直播间素材` controls and pending-file flow.
- Create: `frontend/src/pages/merchant/ProductForm.test.tsx` if no focused form test exists.
  - Tests live media create/edit/readonly behavior.
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
  - Renders configured video/image scene.
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`
  - Tests video/image/fallback media rendering.
- Modify: `scripts/demo-seed.mjs`
  - Seeds live media for at least one active demo auction.

## Task 1: Backend Live Media Schema And Repository

**Files:**
- Create: `backend/migrations/008_create_product_live_media.sql`
- Create: `backend/internal/model/product_live_media.go`
- Modify: `backend/internal/dto/product.go`
- Modify: `backend/internal/repository/product_repo.go`
- Test: `backend/tests/integration/product_test.go`

- [ ] **Step 1: Add failing integration test for product detail live media**

Add a test near existing product integration tests:

```go
func TestProductDetailIncludesLiveMedia(t *testing.T) {
	ts, db := setupProductTestServer(t)
	merchantToken := registerAndLogin(t, ts, "live_media_merchant", "merchant")

	productID, _ := createAndPublishProduct(t, ts, merchantToken, "Live Media Product", "/static/images/live-media-product.jpg")
	_, err := db.Exec(`
		INSERT INTO product_live_media (product_id, media_type, media_url, poster_url)
		VALUES (?, 'image', '/static/live-media/live-room.webp', NULL)
		ON DUPLICATE KEY UPDATE media_type = VALUES(media_type), media_url = VALUES(media_url), poster_url = VALUES(poster_url)
	`, productID)
	if err != nil {
		t.Fatalf("insert live media: %v", err)
	}

	resp := productRequest(t, "GET", ts.URL+fmt.Sprintf("/api/v1/products/%d", productID), merchantToken, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected detail 200, got %d", resp.StatusCode)
	}
	body := decodeData(t, resp)
	liveMedia := body["live_media"].(map[string]interface{})
	if liveMedia["type"] != "image" {
		t.Fatalf("expected image live media, got %#v", liveMedia["type"])
	}
	if liveMedia["url"] != "/static/live-media/live-room.webp" {
		t.Fatalf("unexpected live media url %#v", liveMedia["url"])
	}
}
```

- [ ] **Step 2: Run test and confirm it fails because the table/field does not exist**

Run:

```bash
cd backend && go test ./tests/integration -run TestProductDetailIncludesLiveMedia -count=1
```

Expected: FAIL with either missing `product_live_media` table or missing `live_media` response field.

- [ ] **Step 3: Add migration**

Create `backend/migrations/008_create_product_live_media.sql`:

```sql
CREATE TABLE IF NOT EXISTS product_live_media (
    product_id BIGINT PRIMARY KEY,
    media_type ENUM('image','video') NOT NULL,
    media_url  VARCHAR(255) NOT NULL,
    poster_url VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 4: Add model and DTO fields**

Create `backend/internal/model/product_live_media.go`:

```go
package model

import "time"

type ProductLiveMedia struct {
	ProductID  int64      `json:"product_id"`
	MediaType  string     `json:"type"`
	MediaURL   string     `json:"url"`
	PosterURL  *string    `json:"poster_url,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}
```

Modify `backend/internal/dto/product.go`:

```go
type ProductDetailResponse struct {
	Product   model.Product          `json:"product"`
	Images    []model.ProductImage   `json:"images"`
	LiveMedia *model.ProductLiveMedia `json:"live_media,omitempty"`
	Auction   *model.Auction         `json:"auction"`
}
```

- [ ] **Step 5: Add repository methods**

Add to `backend/internal/repository/product_repo.go`:

```go
func (r *ProductRepo) FindLiveMedia(productID int64) (*model.ProductLiveMedia, error) {
	media := &model.ProductLiveMedia{}
	var posterURL sql.NullString
	err := r.db.QueryRow(
		`SELECT product_id, media_type, media_url, poster_url, created_at, updated_at
         FROM product_live_media WHERE product_id = ?`, productID,
	).Scan(&media.ProductID, &media.MediaType, &media.MediaURL, &posterURL, &media.CreatedAt, &media.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if posterURL.Valid {
		value := posterURL.String
		media.PosterURL = &value
	}
	return media, nil
}

func (r *ProductRepo) UpsertLiveMedia(productID int64, mediaType, mediaURL string, posterURL *string) error {
	_, err := r.db.Exec(
		`INSERT INTO product_live_media (product_id, media_type, media_url, poster_url)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE media_type = VALUES(media_type), media_url = VALUES(media_url), poster_url = VALUES(poster_url)`,
		productID, mediaType, mediaURL, posterURL,
	)
	return err
}

func (r *ProductRepo) DeleteLiveMedia(productID int64) error {
	_, err := r.db.Exec(`DELETE FROM product_live_media WHERE product_id = ?`, productID)
	return err
}
```

- [ ] **Step 6: Include live media in service responses**

In `ProductService.Create`, `Publish`, `Get`, and `Update`, fetch live media and set it on `ProductDetailResponse`.

Use this helper inside `ProductService`:

```go
func (s *ProductService) detailResponse(product *model.Product, images []model.ProductImage, auction *model.Auction) (*dto.ProductDetailResponse, error) {
	liveMedia, err := s.productRepo.FindLiveMedia(product.ID)
	if err != nil {
		return nil, err
	}
	return &dto.ProductDetailResponse{
		Product:   *product,
		Images:    images,
		LiveMedia: liveMedia,
		Auction:   auction,
	}, nil
}
```

- [ ] **Step 7: Run focused backend test**

Run:

```bash
cd backend && go test ./tests/integration -run TestProductDetailIncludesLiveMedia -count=1
```

Expected: PASS.

- [ ] **Step 8: Commit backend schema slice**

Run:

```bash
git add backend/migrations/008_create_product_live_media.sql backend/internal/model/product_live_media.go backend/internal/dto/product.go backend/internal/repository/product_repo.go backend/internal/service/product_service.go backend/tests/integration/product_test.go
git commit -m "feat(merchant): add product live media model"
```

## Task 2: Backend Upload API, Static Serving, And Guards

**Files:**
- Modify: `backend/internal/config/config.go`
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/internal/service/product_service.go`
- Modify: `backend/internal/handler/product_handler.go`
- Test: `backend/tests/integration/product_test.go`

- [ ] **Step 1: Add failing upload tests**

Add tests for success and guards:

```go
func TestMerchantUploadsProductLiveMedia(t *testing.T) {
	ts, _ := setupProductTestServer(t)
	merchantToken := registerAndLogin(t, ts, "live_media_upload_merchant", "merchant")
	productID := createDraftProduct(t, ts, merchantToken, "Upload Live Media")

	resp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "scene.webp", "image/webp", []byte("RIFF image bytes"))
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected upload 200, got %d", resp.StatusCode)
	}
	body := decodeData(t, resp)
	if body["type"] != "image" {
		t.Fatalf("expected image type, got %#v", body["type"])
	}
	if !strings.HasPrefix(body["url"].(string), "/static/live-media/") {
		t.Fatalf("expected live media static url, got %#v", body["url"])
	}
}

func TestProductLiveMediaGuards(t *testing.T) {
	ts, _ := setupProductTestServer(t)
	ownerToken := registerAndLogin(t, ts, "live_media_owner", "merchant")
	otherToken := registerAndLogin(t, ts, "live_media_other", "merchant")
	productID := createDraftProduct(t, ts, ownerToken, "Guarded Live Media")

	nonOwner := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), otherToken, "media", "scene.webp", "image/webp", []byte("image"))
	if nonOwner.StatusCode != http.StatusForbidden {
		t.Fatalf("expected non-owner forbidden, got %d", nonOwner.StatusCode)
	}
	nonOwner.Body.Close()

	badType := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), ownerToken, "media", "scene.txt", "text/plain", []byte("plain"))
	if badType.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected bad type rejected, got %d", badType.StatusCode)
	}
	badType.Body.Close()
}
```

- [ ] **Step 2: Run tests and confirm routes are missing**

Run:

```bash
cd backend && go test ./tests/integration -run 'TestMerchantUploadsProductLiveMedia|TestProductLiveMediaGuards' -count=1
```

Expected: FAIL with route not found or missing handler.

- [ ] **Step 3: Add config/static route**

Modify `backend/internal/config/config.go`:

```go
type Config struct {
	// existing fields
	LiveMediaDir string
}

func Load() *Config {
	return &Config{
		// existing fields
		LiveMediaDir: getEnv("LIVE_MEDIA_DIR", "./static/live-media"),
	}
}
```

Modify `backend/cmd/server/main.go`:

```go
productH := handler.NewProductHandler(productSvc, cfg.ImageDir, cfg.LiveMediaDir)
r.Static("/static/live-media", cfg.LiveMediaDir)
```

Also ensure the directory exists on startup using the same pattern as other static directories if one is present.

- [ ] **Step 4: Update handler constructor and routes**

Modify `ProductHandler`:

```go
type ProductHandler struct {
	svc          *service.ProductService
	imageDir     string
	liveMediaDir string
}

func NewProductHandler(svc *service.ProductService, imageDir, liveMediaDir string) *ProductHandler {
	return &ProductHandler{svc: svc, imageDir: imageDir, liveMediaDir: liveMediaDir}
}
```

Register routes wherever product routes are declared:

```go
products.POST("/:id/live-media", middleware.RoleGuard("merchant"), productH.UploadLiveMedia)
products.DELETE("/:id/live-media", middleware.RoleGuard("merchant"), productH.DeleteLiveMedia)
```

- [ ] **Step 5: Add service mutation methods**

Add to `ProductService`:

```go
var ErrInvalidLiveMediaType = errors.New("仅支持 jpg/png/webp/mp4/webm 格式")

func (s *ProductService) ReplaceLiveMedia(merchantID, productID int64, mediaType, url string, posterURL *string) (*model.ProductLiveMedia, error) {
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
	if mediaType != "image" && mediaType != "video" {
		return nil, ErrInvalidLiveMediaType
	}
	if err := s.productRepo.UpsertLiveMedia(productID, mediaType, url, posterURL); err != nil {
		return nil, err
	}
	return s.productRepo.FindLiveMedia(productID)
}

func (s *ProductService) DeleteLiveMedia(merchantID, productID int64) error {
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
	return s.productRepo.DeleteLiveMedia(productID)
}
```

- [ ] **Step 6: Add handler upload validation**

Add helper logic to `product_handler.go`:

```go
const maxLiveImageBytes = 2 * 1024 * 1024
const maxLiveVideoBytes = 20 * 1024 * 1024

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
```

Implement `UploadLiveMedia`:

```go
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
		response.Error(c, http.StatusBadRequest, mediaType == "video" ? "视频大小不能超过20MB" : "图片大小不能超过2MB")
		return
	}
	filename := fmt.Sprintf("live_%d_%d%s", productID, time.Now().UnixNano(), ext)
	savePath := filepath.Join(h.liveMediaDir, filename)
	if err := c.SaveUploadedFile(file, savePath); err != nil {
		response.Error(c, http.StatusInternalServerError, "直播间素材上传失败")
		return
	}
	media, err := h.svc.ReplaceLiveMedia(merchantID, productID, mediaType, "/static/live-media/"+filename, nil)
	if err != nil {
		respondProductMutationError(c, err)
		return
	}
	response.Success(c, http.StatusOK, media)
}
```

Implement `DeleteLiveMedia` with `h.svc.DeleteLiveMedia`.

- [ ] **Step 7: Run focused upload tests**

Run:

```bash
cd backend && go test ./tests/integration -run 'TestMerchantUploadsProductLiveMedia|TestProductLiveMediaGuards|TestProductDetailIncludesLiveMedia' -count=1
```

Expected: PASS.

- [ ] **Step 8: Commit upload API slice**

Run:

```bash
git add backend/internal/config/config.go backend/cmd/server/main.go backend/internal/service/product_service.go backend/internal/handler/product_handler.go backend/tests/integration/product_test.go
git commit -m "feat(merchant): add live media upload api"
```

## Task 3: Realtime Snapshot Contract

**Files:**
- Modify: `backend/internal/repository/auction_engine_repo.go`
- Modify: `backend/internal/realtime/message.go`
- Modify: `backend/internal/realtime/snapshot.go`
- Test: `backend/internal/handler/realtime_handler_test.go`

- [ ] **Step 1: Add failing snapshot test**

In `realtime_handler_test.go`, after creating a product and before connecting to WebSocket, insert live media for that product. Then assert snapshot product includes `live_media`:

```go
product := payload["product"].(map[string]interface{})
liveMedia := product["live_media"].(map[string]interface{})
if liveMedia["type"] != "video" {
	t.Fatalf("expected video live media, got %#v", liveMedia["type"])
}
if liveMedia["url"] != "/static/live-media/realtime.mp4" {
	t.Fatalf("unexpected live media url %#v", liveMedia["url"])
}
```

- [ ] **Step 2: Run snapshot test and confirm it fails**

Run:

```bash
cd backend && go test ./internal/handler -run TestRealtimeSnapshotIncludesLiveMedia -count=1
```

Expected: FAIL because snapshot lacks `live_media`.

- [ ] **Step 3: Add live media to snapshot row**

Modify `AuctionSnapshotRow`:

```go
LiveMedia *model.ProductLiveMedia
```

In `BuildAuctionSnapshot` and `FindAuctionSnapshot`, load live media:

```go
liveMedia, err := r.findAuctionSnapshotLiveMedia(ctx, q, row.ProductID)
if err != nil {
	return nil, err
}
row.LiveMedia = liveMedia
```

Add helper:

```go
func (r *AuctionEngineRepo) findAuctionSnapshotLiveMedia(ctx context.Context, q auctionSnapshotQuerier, productID int64) (*model.ProductLiveMedia, error) {
	media := &model.ProductLiveMedia{}
	var posterURL sql.NullString
	err := q.QueryRowContext(ctx,
		`SELECT product_id, media_type, media_url, poster_url, created_at, updated_at
         FROM product_live_media WHERE product_id = ?`, productID,
	).Scan(&media.ProductID, &media.MediaType, &media.MediaURL, &posterURL, &media.CreatedAt, &media.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if posterURL.Valid {
		value := posterURL.String
		media.PosterURL = &value
	}
	return media, nil
}
```

- [ ] **Step 4: Extend realtime product summary**

Modify `backend/internal/realtime/message.go`:

```go
type ProductLiveMediaSummary struct {
	Type      string  `json:"type"`
	URL       string  `json:"url"`
	PosterURL *string `json:"poster_url,omitempty"`
}

type ProductSummary struct {
	ID          int64                    `json:"id"`
	Title       string                   `json:"title"`
	Description string                   `json:"description"`
	ImageURLs   []string                 `json:"image_urls"`
	LiveMedia   *ProductLiveMediaSummary `json:"live_media,omitempty"`
}
```

Modify `snapshot.go` to map row live media:

```go
func toProductLiveMediaSummary(media *model.ProductLiveMedia) *ProductLiveMediaSummary {
	if media == nil {
		return nil
	}
	return &ProductLiveMediaSummary{
		Type:      media.MediaType,
		URL:       media.MediaURL,
		PosterURL: media.PosterURL,
	}
}
```

- [ ] **Step 5: Run snapshot tests**

Run:

```bash
cd backend && go test ./internal/handler -run 'TestRealtimeSnapshot|TestRealtimeSnapshotIncludesLiveMedia' -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit snapshot contract slice**

Run:

```bash
git add backend/internal/repository/auction_engine_repo.go backend/internal/realtime/message.go backend/internal/realtime/snapshot.go backend/internal/handler/realtime_handler_test.go
git commit -m "feat(realtime): include product live media in snapshot"
```

## Task 4: Merchant ProductForm Live Media Controls

**Files:**
- Modify: `frontend/src/types/product.ts`
- Modify: `frontend/src/api/product.ts`
- Modify: `frontend/src/pages/merchant/ProductForm.tsx`
- Create: `frontend/src/pages/merchant/ProductForm.test.tsx`

- [ ] **Step 1: Add frontend types and API tests or mocks**

Define types in `frontend/src/types/product.ts`:

```ts
export interface ProductLiveMedia {
  product_id: number;
  type: 'image' | 'video';
  url: string;
  poster_url?: string;
}

export interface ProductDetail {
  product: Product;
  images: ProductImage[];
  live_media?: ProductLiveMedia | null;
  auction: Auction | null;
}
```

Add API helpers in `frontend/src/api/product.ts`:

```ts
export async function uploadProductLiveMedia(productId: number, file: File): Promise<ProductLiveMedia> {
  const form = new FormData();
  form.append('media', file);
  const { data } = await client.post(`/products/${productId}/live-media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function deleteProductLiveMedia(productId: number): Promise<void> {
  await client.delete(`/products/${productId}/live-media`);
}
```

- [ ] **Step 2: Write failing ProductForm tests**

Create `ProductForm.test.tsx` with mocked product API:

```tsx
it('shows live media controls separately from product images', async () => {
  renderProductForm('/merchant/products/new');
  expect(screen.getByText('商品图片')).toBeInTheDocument();
  expect(screen.getByText('直播间素材')).toBeInTheDocument();
  expect(screen.getByText('用于用户直播间背景，商品图片仍用于大厅和订单')).toBeInTheDocument();
});

it('previews existing live video media in edit mode', async () => {
  mockGetProduct.mockResolvedValueOnce({
    product: { id: 9, merchant_id: 1, title: '玉坠', description: '', status: 'pending', created_at: '', updated_at: '' },
    images: [{ id: 1, product_id: 9, image_url: '/static/images/p.jpg', sort_order: 0 }],
    live_media: { product_id: 9, type: 'video', url: '/static/live-media/live.mp4' },
    auction: null,
  });
  renderProductForm('/merchant/products/9/edit');
  expect(await screen.findByText('当前素材：视频')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests and confirm they fail**

Run:

```bash
cd frontend && npm run test -- ProductForm
```

Expected: FAIL because live media controls do not exist.

- [ ] **Step 4: Implement local form state**

Add state in `ProductForm.tsx`:

```ts
const [liveMedia, setLiveMedia] = useState<ProductLiveMedia | null>(null);
const [pendingLiveMediaFile, setPendingLiveMediaFile] = useState<File | null>(null);
const liveMediaReadonly = status !== 'draft' && status !== 'pending' && status !== '';
```

When loading product detail:

```ts
setLiveMedia(detail.live_media ?? null);
```

- [ ] **Step 5: Implement upload flow**

For existing products:

```ts
async function handleLiveMediaFile(file: File) {
  if (id) {
    const media = await uploadProductLiveMedia(parseInt(id), file);
    setLiveMedia(media);
    return;
  }
  setPendingLiveMediaFile(file);
  setLiveMedia({
    product_id: 0,
    type: file.type.startsWith('video/') ? 'video' : 'image',
    url: URL.createObjectURL(file),
  });
}
```

For new products after `createProduct`:

```ts
if (pendingLiveMediaFile) {
  await uploadProductLiveMedia(result.product.id, pendingLiveMediaFile);
}
```

- [ ] **Step 6: Implement live media UI block**

Add a block below product images:

```tsx
<div>
  <label className="text-white/70 text-sm block mb-2">直播间素材</label>
  <p className="mb-3 text-xs text-white/50">用于用户直播间背景，商品图片仍用于大厅和订单</p>
  {liveMedia ? (
    <div className="rounded-lg border border-white/20 bg-white/5 p-3">
      <div className="text-sm font-semibold text-white">
        当前素材：{liveMedia.type === 'video' ? '视频' : '图片'}
      </div>
      {liveMedia.type === 'video' ? (
        <video src={liveMedia.url} className="mt-3 aspect-video w-full rounded-lg object-cover" muted playsInline controls />
      ) : (
        <img src={liveMedia.url} alt="直播间素材预览" className="mt-3 aspect-video w-full rounded-lg object-cover" />
      )}
      {!liveMediaReadonly && (
        <button type="button" onClick={handleRemoveLiveMedia} className="mt-3 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white">
          移除素材
        </button>
      )}
    </div>
  ) : (
    <button type="button" disabled={liveMediaReadonly} onClick={() => liveMediaInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-white/30 px-4 py-6 text-sm text-white/70 disabled:opacity-45">
      上传直播背景图或短视频
    </button>
  )}
</div>
```

- [ ] **Step 7: Run focused frontend tests**

Run:

```bash
cd frontend && npm run test -- ProductForm
```

Expected: PASS.

- [ ] **Step 8: Commit merchant frontend slice**

Run:

```bash
git add frontend/src/types/product.ts frontend/src/api/product.ts frontend/src/pages/merchant/ProductForm.tsx frontend/src/pages/merchant/ProductForm.test.tsx
git commit -m "feat(frontend): add merchant live media controls"
```

## Task 5: Buyer Live Room Media Rendering

**Files:**
- Modify: `frontend/src/types/auction.ts`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [ ] **Step 1: Add auction type**

Modify `frontend/src/types/auction.ts`:

```ts
export interface ProductLiveMediaSummary {
  type: 'image' | 'video';
  url: string;
  poster_url?: string;
}

export interface ProductSummary {
  id: number;
  title: string;
  description: string;
  image_urls: string[];
  live_media?: ProductLiveMediaSummary | null;
}
```

- [ ] **Step 2: Add failing live-room tests**

In `LiveAuctionRoom.test.tsx`, add snapshot cases:

```tsx
it('renders configured video live media before fallback scene', async () => {
  renderLiveRoomWithSnapshot({
    product: {
      id: 4,
      title: 'Vintage jacket',
      description: 'Denim',
      image_urls: ['https://img.test/jacket.jpg'],
      live_media: { type: 'video', url: 'https://media.test/live.mp4', poster_url: 'https://img.test/poster.jpg' },
    },
  });
  const video = await screen.findByLabelText('直播间视频素材');
  expect(video).toHaveAttribute('src', 'https://media.test/live.mp4');
  expect(video).toHaveAttribute('poster', 'https://img.test/poster.jpg');
});

it('renders configured image live media', async () => {
  renderLiveRoomWithSnapshot({
    product: {
      id: 4,
      title: 'Vintage jacket',
      description: 'Denim',
      image_urls: ['https://img.test/jacket.jpg'],
      live_media: { type: 'image', url: 'https://media.test/live.webp' },
    },
  });
  expect(await screen.findByAltText('直播间素材')).toHaveAttribute('src', 'https://media.test/live.webp');
});
```

- [ ] **Step 3: Run tests and confirm they fail**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

Expected: FAIL because media elements are absent.

- [ ] **Step 4: Implement scene media priority**

In `LiveAuctionRoom.tsx`:

```ts
const liveMedia = roomProduct?.live_media ?? null;
const heroImage = roomProduct?.image_urls?.[0] || heroFallback;
```

Render before staged overlays:

```tsx
{liveMedia?.type === 'video' ? (
  <video
    aria-label="直播间视频素材"
    src={liveMedia.url}
    poster={liveMedia.poster_url || heroImage}
    className="absolute inset-0 h-full w-full object-cover"
    autoPlay
    muted
    loop
    playsInline
  />
) : liveMedia?.type === 'image' ? (
  <img src={liveMedia.url} alt="直播间素材" className="absolute inset-0 h-full w-full object-cover" />
) : null}
```

Keep the current staged fallback visible when `!liveMedia`.

- [ ] **Step 5: Run live-room tests**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

Expected: PASS.

- [ ] **Step 6: Commit buyer live-room slice**

Run:

```bash
git add frontend/src/types/auction.ts frontend/src/pages/app/LiveAuctionRoom.tsx frontend/src/pages/app/LiveAuctionRoom.test.tsx
git commit -m "feat(frontend): render live room media"
```

## Task 6: Demo Seed And Summary Image Safeguards

**Files:**
- Modify: `scripts/demo-seed.mjs`
- Test: `backend/tests/integration/product_test.go`
- Test: `backend/internal/service/order_service_test.go` or existing order integration test file if present

- [ ] **Step 1: Add backend summary-image regression test**

Add a test proving lobby image is not live media:

```go
func TestAuctionLobbyUsesProductImageNotLiveMedia(t *testing.T) {
	ts, db := setupProductTestServer(t)
	merchantToken := registerAndLogin(t, ts, "summary_media_merchant", "merchant")
	userToken := registerAndLogin(t, ts, "summary_media_buyer", "user")
	productID, auctionID := createAndPublishProduct(t, ts, merchantToken, "Summary Media Product", "/static/images/product-card.jpg")
	activateAuctionForTest(t, db, auctionID)
	_, err := db.Exec(`INSERT INTO product_live_media (product_id, media_type, media_url) VALUES (?, 'video', '/static/live-media/live.mp4')`, productID)
	if err != nil {
		t.Fatalf("insert live media: %v", err)
	}

	resp := productRequest(t, "GET", ts.URL+"/api/v1/products?status=active", userToken, nil)
	defer resp.Body.Close()
	body := decodeData(t, resp)
	items := body["items"].([]interface{})
	item := items[0].(map[string]interface{})
	if item["image_url"] != "/static/images/product-card.jpg" {
		t.Fatalf("expected product image summary, got %#v", item["image_url"])
	}
}
```

- [ ] **Step 2: Run summary regression test**

Run:

```bash
cd backend && go test ./tests/integration -run TestAuctionLobbyUsesProductImageNotLiveMedia -count=1
```

Expected: PASS after Task 1-3 because lobby query still uses `product_images`.

- [ ] **Step 3: Update demo seed**

Modify `scripts/demo-seed.mjs` to upsert live media after creating the demo product:

```js
await connection.execute(
  `INSERT INTO product_live_media (product_id, media_type, media_url, poster_url)
   VALUES (?, 'image', '/static/images/demo-auction-product.svg', '/static/images/demo-auction-product.svg')
   ON DUPLICATE KEY UPDATE media_type = VALUES(media_type), media_url = VALUES(media_url), poster_url = VALUES(poster_url)`,
  [productId],
);
```

Use an image fixture for committed seed stability. Runtime merchants can upload video through the UI.

- [ ] **Step 4: Run demo seed**

Run with local backend DB available:

```bash
npm run demo:seed
```

Expected: command exits `0` and prints a live room URL.

- [ ] **Step 5: Commit demo/safeguard slice**

Run:

```bash
git add scripts/demo-seed.mjs backend/tests/integration/product_test.go
git commit -m "test(demo): seed product live media"
```

## Task 7: Final Verification, Plan Sync, Memory

**Files:**
- Modify: `openspec/changes/merchant-live-media/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-03-merchant-live-media.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-03.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd backend && go test ./...
```

Expected: PASS.

- [ ] **Step 2: Run frontend focused tests**

Run:

```bash
cd frontend && npm run test -- ProductForm
cd frontend && npm run test -- LiveAuctionRoom
```

Expected: PASS.

- [ ] **Step 3: Run required build and spec checks**

Run:

```bash
cd frontend && npm run build
npx -y @fission-ai/openspec@latest validate merchant-live-media --strict --no-interactive
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 4: Manual preview**

With local backend/frontend running:

```bash
npm run demo:seed
```

Then verify:

- `demo_merchant / test123` sees `直播间素材` on `/merchant/products/:id/edit`.
- `demo_buyer_a / test123` sees normal product imagery on `/app/auctions`.
- `demo_buyer_a / test123` sees merchant-controlled media on `/app/auctions/:id`.

- [ ] **Step 5: Sync task documents**

Update:

- `openspec/changes/merchant-live-media/tasks.md`
- `docs/superpowers/plans/2026-06-03-merchant-live-media.md`

Only mark checkboxes complete when their verification has actually passed.

- [ ] **Step 6: Update memory**

Record delivered behavior, verification commands/results, remaining risks, and next step in:

- `projects/proj-1779447357476-ryiijf/memory/2026-06-03.md`
- `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [ ] **Step 7: Commit and push final verified slice**

Run:

```bash
git status --short
git add openspec/changes/merchant-live-media/tasks.md docs/superpowers/plans/2026-06-03-merchant-live-media.md projects/proj-1779447357476-ryiijf/memory/2026-06-03.md projects/proj-1779447357476-ryiijf/memory/long-term.md
git commit -m "docs: complete merchant live media plan"
git push
```

Expected: branch push succeeds. If a push hook fails after all verification has passed, report the exact hook failure before retrying.

## Plan Self-Review

- Spec coverage: merchant configuration, upload guards, product detail, realtime snapshot, merchant frontend, buyer live-room rendering, summary image separation, demo seed, and verification all map to tasks above.
- Placeholder scan: no placeholder markers or unspecified edge-handling steps remain.
- Type consistency: backend uses `ProductLiveMedia` with JSON fields `type`, `url`, and `poster_url`; frontend uses the same public field names while backend DB uses `media_type`, `media_url`, and `poster_url`.
- Scope check: the plan intentionally excludes livestream ingestion, transcoding, full media library, playlists, scheduling, and active-auction media replacement.
