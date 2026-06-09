# Design: h5-live-animations

## Technical Approach

Implement the animation layer as frontend presentation on top of the existing realtime flow:

```text
REST bid command -> wait for WebSocket -> Zustand live room store -> React visible realtime state -> Motion feedback
```

The live room may add local transient animation state, but that state must never become auction truth.

## Motion Integration

- Install `motion` in `frontend/`.
- Import from `motion/react`.
- Use:
  - `motion` for animated wrappers and particles;
  - `AnimatePresence` for entering/exiting coin and warning accents;
  - `useReducedMotion` to lower movement for users who prefer less motion.
- Keep all animation helpers local to `LiveAuctionRoom.tsx` unless a later slice creates real reuse.

## Effect Triggers

### Price Update

Use the existing current-price comparison effect. When `roomCurrentPrice` changes for the current room, set a short-lived `pricePulse` state. Motion animates scale, color glow, and shadow on the price display. Tests assert visible price feedback text or stable test id, not pixel details.

### Bid Success And Leading

Detect transitions where:

- auction is active;
- current room is valid;
- authenticated user id exists;
- `highestBidderId === user.id`;
- previous tracked leading state was false;
- initial leading comparison has already been established.

On that transition, set a short-lived bid-success animation key and show a small coin burst near the floating auction card. The persistent leading state also adds a warm Motion accent around the floating card.

### Outbid

Use the latest private `outbid` notification id as the event key. When it changes while the auction is active and the user is not leading, show a red warning pulse and recovery emphasis. The effect is non-blocking and does not open a modal.

### Last Ten Seconds

When `urgent` is true, Motion animates the countdown with a heartbeat rhythm. When `urgent` becomes false or the auction reaches terminal state, the heartbeat stops.

## Reduced Motion

When `useReducedMotion()` returns true:

- suppress coin burst particle movement;
- replace repeated heartbeat/pulse loops with a stable emphasized style;
- keep visible text markers such as `价格已更新`, `领先中`, `立即追回`, and final countdown copy.

## Test Strategy

Focused tests should validate behavior, not exact animation frames:

- REST bid success does not render accepted-bid animation.
- WebSocket `price_update` updates price and renders price feedback.
- Transition into authenticated-user leading state renders bid-success and leading feedback.
- Private outbid notification renders warning/recovery feedback.
- Last-10-second countdown renders urgency feedback.
- Terminal state disables bidding and suppresses active-auction effects.

## Verification

- `cd frontend && npm run test -- LiveAuctionRoom`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `npx -y @fission-ai/openspec@latest validate h5-live-animations --strict --no-interactive`
- `git diff --check`

Backend tests are not required unless backend files are changed.
