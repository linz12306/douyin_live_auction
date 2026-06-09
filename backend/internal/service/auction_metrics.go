package service

import (
	"sync/atomic"
	"time"
)

type AuctionMetrics struct {
	bidRequestsTotal          atomic.Uint64
	bidSuccessTotal           atomic.Uint64
	bidFailureTotal           atomic.Uint64
	bidLatencyNanos           atomic.Uint64
	bidLockBusyTotal          atomic.Uint64
	bidLockDegradedTotal      atomic.Uint64
	bidCommandEnqueueTotal    atomic.Uint64
	bidCommandProcessingTotal atomic.Uint64
	bidCommandAcceptedTotal   atomic.Uint64
	bidCommandRejectedTotal   atomic.Uint64
	bidCommandFailedTotal     atomic.Uint64
}

type AuctionMetricsSnapshot struct {
	BidRequestsTotal          uint64  `json:"bid_requests_total"`
	BidSuccessTotal           uint64  `json:"bid_success_total"`
	BidFailureTotal           uint64  `json:"bid_failure_total"`
	BidSuccessRate            float64 `json:"bid_success_rate"`
	BidAvgLatencyMS           float64 `json:"bid_avg_latency_ms"`
	BidLockBusyTotal          uint64  `json:"bid_lock_busy_total"`
	BidLockDegradedTotal      uint64  `json:"bid_lock_degraded_total"`
	BidCommandEnqueueTotal    uint64  `json:"bid_command_enqueue_total"`
	BidCommandProcessingTotal uint64  `json:"bid_command_processing_total"`
	BidCommandAcceptedTotal   uint64  `json:"bid_command_accepted_total"`
	BidCommandRejectedTotal   uint64  `json:"bid_command_rejected_total"`
	BidCommandFailedTotal     uint64  `json:"bid_command_failed_total"`
}

func NewAuctionMetrics() *AuctionMetrics {
	return &AuctionMetrics{}
}

func (m *AuctionMetrics) RecordBid(success bool, latency time.Duration) {
	if m == nil {
		return
	}
	m.bidRequestsTotal.Add(1)
	if success {
		m.bidSuccessTotal.Add(1)
	} else {
		m.bidFailureTotal.Add(1)
	}
	if latency > 0 {
		m.bidLatencyNanos.Add(uint64(latency.Nanoseconds()))
	}
}

func (m *AuctionMetrics) RecordLockBusy() {
	if m == nil {
		return
	}
	m.bidLockBusyTotal.Add(1)
}

func (m *AuctionMetrics) RecordLockDegraded() {
	if m == nil {
		return
	}
	m.bidLockDegradedTotal.Add(1)
}

func (m *AuctionMetrics) RecordBidCommand(status string) {
	if m == nil {
		return
	}
	switch status {
	case "queued":
		m.bidCommandEnqueueTotal.Add(1)
	case "processing":
		m.bidCommandProcessingTotal.Add(1)
	case "accepted":
		m.bidCommandAcceptedTotal.Add(1)
	case "rejected":
		m.bidCommandRejectedTotal.Add(1)
	case "failed":
		m.bidCommandFailedTotal.Add(1)
	}
}

func (m *AuctionMetrics) Snapshot() AuctionMetricsSnapshot {
	if m == nil {
		return AuctionMetricsSnapshot{}
	}
	requests := m.bidRequestsTotal.Load()
	successes := m.bidSuccessTotal.Load()
	failures := m.bidFailureTotal.Load()
	latencyNanos := m.bidLatencyNanos.Load()

	snapshot := AuctionMetricsSnapshot{
		BidRequestsTotal:          requests,
		BidSuccessTotal:           successes,
		BidFailureTotal:           failures,
		BidLockBusyTotal:          m.bidLockBusyTotal.Load(),
		BidLockDegradedTotal:      m.bidLockDegradedTotal.Load(),
		BidCommandEnqueueTotal:    m.bidCommandEnqueueTotal.Load(),
		BidCommandProcessingTotal: m.bidCommandProcessingTotal.Load(),
		BidCommandAcceptedTotal:   m.bidCommandAcceptedTotal.Load(),
		BidCommandRejectedTotal:   m.bidCommandRejectedTotal.Load(),
		BidCommandFailedTotal:     m.bidCommandFailedTotal.Load(),
	}
	if requests > 0 {
		snapshot.BidSuccessRate = float64(successes) / float64(requests)
		snapshot.BidAvgLatencyMS = float64(latencyNanos) / float64(requests) / float64(time.Millisecond)
	}
	return snapshot
}
