package realtime

import (
	"encoding/json"
	"testing"
	"time"
)

func TestEnvelopeJSONIncludesOrderingFields(t *testing.T) {
	serverTime := time.Date(2026, 5, 28, 10, 11, 12, 0, time.UTC)
	envelope := Envelope{
		Type:       MessagePriceUpdate,
		AuctionID:  42,
		Version:    7,
		ServerTime: serverTime,
		Payload: PriceUpdatePayload{
			CurrentPrice:    188.8,
			HighestBidderID: 99,
		},
	}

	body, err := json.Marshal(envelope)
	if err != nil {
		t.Fatalf("marshal envelope: %v", err)
	}

	var got map[string]json.RawMessage
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal envelope: %v", err)
	}

	for _, field := range []string{"type", "auction_id", "version", "server_time", "payload"} {
		if _, ok := got[field]; !ok {
			t.Fatalf("marshalled envelope missing %q: %s", field, body)
		}
	}
}

func TestSnapshotMessageUsesStableType(t *testing.T) {
	envelope := Envelope{
		Type:       MessageSnapshot,
		AuctionID:  42,
		Version:    1,
		ServerTime: time.Date(2026, 5, 28, 10, 11, 12, 0, time.UTC),
		Payload: SnapshotPayload{
			Product:      ProductSummary{ID: 10, Title: "Vintage Camera"},
			Status:       "active",
			CurrentPrice: 100,
		},
	}

	body, err := json.Marshal(envelope)
	if err != nil {
		t.Fatalf("marshal snapshot envelope: %v", err)
	}

	var got struct {
		Type      string          `json:"type"`
		AuctionID int64           `json:"auction_id"`
		Version   int64           `json:"version"`
		Time      time.Time       `json:"server_time"`
		Payload   json.RawMessage `json:"payload"`
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal snapshot envelope: %v", err)
	}

	if got.Type != MessageSnapshot {
		t.Fatalf("snapshot type = %q, want %q", got.Type, MessageSnapshot)
	}
	if got.AuctionID == 0 || got.Version == 0 || got.Time.IsZero() || len(got.Payload) == 0 {
		t.Fatalf("snapshot envelope missing ordering fields or payload: %+v", got)
	}
}
