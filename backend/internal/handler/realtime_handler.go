package handler

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/realtime"
	pkgjwt "douyin-live/backend/pkg/jwt"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	wsWriteWait  = 10 * time.Second
	wsPongWait   = 60 * time.Second
	wsPingPeriod = 30 * time.Second
	wsSendBuffer = 16
)

type RealtimeHandler struct {
	hub       *realtime.Hub
	snapshots auctionSnapshotter
	cfg       *config.Config
	upgrader  websocket.Upgrader
}

type auctionSnapshotter interface {
	Snapshot(ctx context.Context, auctionID int64) (*realtime.Envelope, error)
}

func NewRealtimeHandler(hub *realtime.Hub, snapshots *realtime.SnapshotProvider, cfg *config.Config) *RealtimeHandler {
	return &RealtimeHandler{
		hub:       hub,
		snapshots: snapshots,
		cfg:       cfg,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (h *RealtimeHandler) AuctionRoom(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		response.Error(c, http.StatusUnauthorized, "未提供认证令牌")
		return
	}

	claims, err := pkgjwt.ParseAccessToken(token, h.cfg.JWTSecret)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "令牌无效或已过期")
		return
	}

	auctionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || auctionID <= 0 {
		response.Error(c, http.StatusBadRequest, "竞拍ID无效")
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	send := make(chan realtime.Envelope, wsSendBuffer)
	unregister := h.hub.Register(auctionID, claims.UserID, send)
	defer unregister()

	snapshot, err := h.snapshots.Snapshot(c.Request.Context(), auctionID)
	if err != nil {
		return
	}

	if err := writeEnvelope(conn, *snapshot); err != nil {
		return
	}

	done := make(chan struct{})
	go readUntilClose(conn, done)

	ticker := time.NewTicker(wsPingPeriod)
	defer ticker.Stop()

	for {
		select {
		case msg := <-send:
			if isSnapshotRepresentedMessage(msg.Type) && msg.Version <= snapshot.Version {
				continue
			}
			if err := writeEnvelope(conn, msg); err != nil {
				return
			}
		case <-ticker.C:
			if err := conn.SetWriteDeadline(time.Now().Add(wsWriteWait)); err != nil {
				return
			}
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-done:
			return
		case <-c.Request.Context().Done():
			return
		}
	}
}

func isSnapshotRepresentedMessage(messageType string) bool {
	return messageType == realtime.MessagePriceUpdate
}

func writeEnvelope(conn *websocket.Conn, msg realtime.Envelope) error {
	if err := conn.SetWriteDeadline(time.Now().Add(wsWriteWait)); err != nil {
		return err
	}
	return conn.WriteJSON(msg)
}

func readUntilClose(conn *websocket.Conn, done chan<- struct{}) {
	defer close(done)
	_ = conn.SetReadDeadline(time.Now().Add(wsPongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(wsPongWait))
	})
	for {
		if _, _, err := conn.NextReader(); err != nil {
			return
		}
	}
}
