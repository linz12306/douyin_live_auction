package realtime

import (
	"context"
	"sync"
	"time"
)

type Hub struct {
	mu        sync.RWMutex
	rooms     map[int64]map[*hubClient]struct{}
	bus       AuctionEventBus
	snapshots snapshotReader
}

type hubClient struct {
	userID int64
	send   chan<- Envelope
}

type HubStats struct {
	ActiveRooms      int
	ConnectedClients int
}

type snapshotReader interface {
	Snapshot(ctx context.Context, auctionID int64) (*Envelope, error)
}

func NewHub(bus AuctionEventBus, snapshots *SnapshotProvider) *Hub {
	return &Hub{
		rooms:     make(map[int64]map[*hubClient]struct{}),
		bus:       bus,
		snapshots: snapshots,
	}
}

func (h *Hub) Run(ctx context.Context) {
	if h.bus == nil {
		<-ctx.Done()
		return
	}

	events, unsubscribe := h.bus.Subscribe()
	defer unsubscribe()

	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			h.handleEvent(event)
		}
	}
}

func (h *Hub) Stats() HubStats {
	h.mu.RLock()
	defer h.mu.RUnlock()

	stats := HubStats{ActiveRooms: len(h.rooms)}
	for _, clients := range h.rooms {
		stats.ConnectedClients += len(clients)
	}
	return stats
}

func (h *Hub) Register(auctionID int64, userID int64, send chan<- Envelope) func() {
	client := &hubClient{userID: userID, send: send}

	h.mu.Lock()
	if h.rooms[auctionID] == nil {
		h.rooms[auctionID] = make(map[*hubClient]struct{})
	}
	h.rooms[auctionID][client] = struct{}{}
	h.mu.Unlock()

	var once sync.Once
	return func() {
		once.Do(func() {
			h.mu.Lock()
			if room := h.rooms[auctionID]; room != nil {
				delete(room, client)
				if len(room) == 0 {
					delete(h.rooms, auctionID)
				}
			}
			h.mu.Unlock()
		})
	}
}

func (h *Hub) Broadcast(auctionID int64, msg Envelope) {
	h.mu.RLock()
	recipients := make([]chan<- Envelope, 0, len(h.rooms[auctionID]))
	for client := range h.rooms[auctionID] {
		recipients = append(recipients, client.send)
	}
	h.mu.RUnlock()

	for _, recipient := range recipients {
		deliver(recipient, msg)
	}
}

func (h *Hub) SendToUser(auctionID int64, userID int64, msg Envelope) {
	h.mu.RLock()
	recipients := make([]chan<- Envelope, 0)
	for client := range h.rooms[auctionID] {
		if client.userID == userID {
			recipients = append(recipients, client.send)
		}
	}
	h.mu.RUnlock()

	for _, recipient := range recipients {
		deliver(recipient, msg)
	}
}

func (h *Hub) handleEvent(event AuctionEvent) {
	switch event.Type {
	case EventBidAccepted:
		h.Broadcast(event.AuctionID, h.priceUpdateEnvelope(event))
	case EventBidOutbid:
		if event.PreviousUserID == nil {
			return
		}
		h.SendToUser(event.AuctionID, *event.PreviousUserID, Envelope{
			Type:       MessageOutbid,
			AuctionID:  event.AuctionID,
			Version:    event.Version,
			ServerTime: eventTime(event),
			Payload: OutbidPayload{
				PreviousAmount: event.PreviousAmount,
				NewAmount:      event.Amount,
				NewBidderID:    event.UserID,
			},
		})
	case EventAuctionExtended:
		if event.EndedAt == nil {
			return
		}
		h.Broadcast(event.AuctionID, Envelope{
			Type:       MessageExtended,
			AuctionID:  event.AuctionID,
			Version:    event.Version,
			ServerTime: eventTime(event),
			Payload: ExtendedPayload{
				EndedAt:            *event.EndedAt,
				CurrentExtendCount: event.ExtendCount,
			},
		})
	case EventAuctionEnded, EventAuctionCancelled:
		var winnerID *int64
		if event.UserID > 0 {
			id := event.UserID
			winnerID = &id
		}
		h.Broadcast(event.AuctionID, Envelope{
			Type:       MessageAuctionEnd,
			AuctionID:  event.AuctionID,
			Version:    event.Version,
			ServerTime: eventTime(event),
			Payload: AuctionEndPayload{
				Status:          event.Status,
				WinnerID:        winnerID,
				FinalPrice:      event.Amount,
				TerminalMessage: terminalMessage(event),
			},
		})
	}
}

func (h *Hub) priceUpdateEnvelope(event AuctionEvent) Envelope {
	envelope := Envelope{
		Type:       MessagePriceUpdate,
		AuctionID:  event.AuctionID,
		Version:    event.Version,
		ServerTime: eventTime(event),
		Payload: PriceUpdatePayload{
			CurrentPrice:    event.Amount,
			HighestBidderID: event.UserID,
			Rankings:        nil,
		},
	}
	if h.snapshots == nil {
		return envelope
	}

	snapshot, err := h.snapshots.Snapshot(context.Background(), event.AuctionID)
	if err != nil {
		return envelope
	}
	if snapshot.Version != event.Version {
		return envelope
	}
	snapshotPayload, ok := snapshot.Payload.(SnapshotPayload)
	if !ok {
		return envelope
	}
	payload := PriceUpdatePayload{
		CurrentPrice:    snapshotPayload.CurrentPrice,
		HighestBidderID: event.UserID,
		Rankings:        snapshotPayload.Rankings,
	}
	if snapshotPayload.HighestBidderID != nil {
		payload.HighestBidderID = *snapshotPayload.HighestBidderID
	}
	envelope.Version = snapshot.Version
	envelope.ServerTime = snapshot.ServerTime
	envelope.Payload = payload
	return envelope
}

func deliver(ch chan<- Envelope, msg Envelope) {
	select {
	case ch <- msg:
	default:
	}
}

func eventTime(event AuctionEvent) time.Time {
	if event.OccurredAt.IsZero() {
		return time.Now()
	}
	return event.OccurredAt
}

func terminalMessage(event AuctionEvent) string {
	switch event.Type {
	case EventAuctionCancelled:
		return "竞拍已取消"
	case EventAuctionEnded:
		if event.Status == "ended_no_bid" {
			return "竞拍已流拍"
		}
		return "竞拍已结束"
	default:
		return ""
	}
}
