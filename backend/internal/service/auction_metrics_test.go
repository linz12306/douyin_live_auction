package service

import (
	"testing"
	"time"
)

func TestAuctionMetricsInitialSnapshot(t *testing.T) {
	metrics := NewAuctionMetrics()

	snapshot := metrics.Snapshot()

	if snapshot.BidRequestsTotal != 0 {
		t.Fatalf("bid requests total = %d, want 0", snapshot.BidRequestsTotal)
	}
	if snapshot.BidSuccessRate != 0 {
		t.Fatalf("success rate = %v, want 0", snapshot.BidSuccessRate)
	}
	if snapshot.BidAvgLatencyMS != 0 {
		t.Fatalf("avg latency = %v, want 0", snapshot.BidAvgLatencyMS)
	}
}

func TestAuctionMetricsRecordsOutcomesAndLatency(t *testing.T) {
	metrics := NewAuctionMetrics()

	metrics.RecordBid(true, 10*time.Millisecond)
	metrics.RecordBid(false, 30*time.Millisecond)
	snapshot := metrics.Snapshot()

	if snapshot.BidRequestsTotal != 2 {
		t.Fatalf("bid requests total = %d, want 2", snapshot.BidRequestsTotal)
	}
	if snapshot.BidSuccessTotal != 1 {
		t.Fatalf("bid success total = %d, want 1", snapshot.BidSuccessTotal)
	}
	if snapshot.BidFailureTotal != 1 {
		t.Fatalf("bid failure total = %d, want 1", snapshot.BidFailureTotal)
	}
	if snapshot.BidSuccessRate != 0.5 {
		t.Fatalf("success rate = %v, want 0.5", snapshot.BidSuccessRate)
	}
	if snapshot.BidAvgLatencyMS != 20 {
		t.Fatalf("avg latency = %v, want 20", snapshot.BidAvgLatencyMS)
	}
}

func TestAuctionMetricsRecordsLockBusy(t *testing.T) {
	metrics := NewAuctionMetrics()

	metrics.RecordLockBusy()
	snapshot := metrics.Snapshot()

	if snapshot.BidLockBusyTotal != 1 {
		t.Fatalf("lock busy total = %d, want 1", snapshot.BidLockBusyTotal)
	}
}
