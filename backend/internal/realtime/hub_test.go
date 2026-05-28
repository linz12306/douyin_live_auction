package realtime

import (
	"testing"
	"time"
)

func TestHubBroadcastsToTwoClientsInSameAuctionRoom(t *testing.T) {
	hub := NewHub(nil, nil)
	first := make(chan Envelope, 1)
	second := make(chan Envelope, 1)
	unregisterFirst := hub.Register(1, 101, first)
	defer unregisterFirst()
	unregisterSecond := hub.Register(1, 102, second)
	defer unregisterSecond()

	msg := Envelope{Type: MessagePriceUpdate, AuctionID: 1, Version: 2}
	hub.Broadcast(1, msg)

	assertEnvelope(t, first, MessagePriceUpdate)
	assertEnvelope(t, second, MessagePriceUpdate)
}

func TestHubDoesNotBroadcastToDifferentAuctionRoom(t *testing.T) {
	hub := NewHub(nil, nil)
	sameRoom := make(chan Envelope, 1)
	otherRoom := make(chan Envelope, 1)
	unregisterSame := hub.Register(1, 101, sameRoom)
	defer unregisterSame()
	unregisterOther := hub.Register(2, 102, otherRoom)
	defer unregisterOther()

	hub.Broadcast(1, Envelope{Type: MessagePriceUpdate, AuctionID: 1, Version: 2})

	assertEnvelope(t, sameRoom, MessagePriceUpdate)
	assertNoEnvelope(t, otherRoom)
}

func TestHubSendsPrivateOutbidOnlyToMatchingUserID(t *testing.T) {
	hub := NewHub(nil, nil)
	outbidUser := make(chan Envelope, 1)
	otherUser := make(chan Envelope, 1)
	unregisterOutbid := hub.Register(1, 101, outbidUser)
	defer unregisterOutbid()
	unregisterOther := hub.Register(1, 102, otherUser)
	defer unregisterOther()

	previousUserID := int64(101)
	hub.handleEvent(AuctionEvent{
		Type:           EventBidOutbid,
		AuctionID:      1,
		Version:        3,
		UserID:         102,
		PreviousUserID: &previousUserID,
		Amount:         120,
		PreviousAmount: 100,
		OccurredAt:     time.Now(),
	})

	assertEnvelope(t, outbidUser, MessageOutbid)
	assertNoEnvelope(t, otherUser)
}

func TestHubUnregisterRemovesClient(t *testing.T) {
	hub := NewHub(nil, nil)
	send := make(chan Envelope, 1)
	unregister := hub.Register(1, 101, send)
	unregister()

	hub.Broadcast(1, Envelope{Type: MessagePriceUpdate, AuctionID: 1, Version: 2})

	assertNoEnvelope(t, send)
}

func assertEnvelope(t *testing.T, ch <-chan Envelope, expectedType string) Envelope {
	t.Helper()

	select {
	case msg := <-ch:
		if msg.Type != expectedType {
			t.Fatalf("expected message type %q, got %q", expectedType, msg.Type)
		}
		return msg
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for message type %q", expectedType)
		return Envelope{}
	}
}

func assertNoEnvelope(t *testing.T, ch <-chan Envelope) {
	t.Helper()

	select {
	case msg := <-ch:
		t.Fatalf("expected no message, got %#v", msg)
	case <-time.After(50 * time.Millisecond):
	}
}
