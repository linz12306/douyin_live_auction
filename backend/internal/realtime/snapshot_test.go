package realtime

import "testing"

func TestNextBidAmountUsesFixedIncrement(t *testing.T) {
	next := nextBidAmount(20, "fixed", 10)

	if next != 30 {
		t.Fatalf("expected next bid amount 30, got %.2f", next)
	}
}

func TestNextBidAmountUsesPercentIncrement(t *testing.T) {
	next := nextBidAmount(99.99, "percent", 10)

	if next != 109.99 {
		t.Fatalf("expected next bid amount 109.99, got %.2f", next)
	}
}
