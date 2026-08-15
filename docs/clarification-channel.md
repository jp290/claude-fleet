# Clarification channel

Fleet carries a worker's narrow question to Program-MAIN as a persisted
`clarification-request` on the existing `FleetEvent` transport. The request is not RPC and does
not create a second message bus: pending, send-uncertain, delivered, receiver-gone, retry, and
acknowledgement retain their existing meanings. A request Ack means only “read”; it never answers
the question.

The worker cannot nominate its receiver. The server accepts only an exact live active
Program-MAIN binding (`slot + openedAt`) or an exact occupant-bound lane/merge Watch whose target
identity matches the lane. Legacy Watches without `slotOpenedAt`, absent evidence, multiple Watch
occupants, and disagreeing Program/Watch evidence are refused. `sessionId` is recorded but is not a
Program-MAIN gate because a Codex bind may change it within the same occupant.

A reply is accepted only from the event's exact receiver session. Fleet verifies that the exact
worker occupant still lives, applies the shared delivery gates, and sends the server-rendered
answer to that worker. Only a successful `sendText` changes the request to `answered` and clears
`awaiting:"main"`; teardown or an invalidated endpoint records a named `refused` terminal state.

A later owner channel should remain a different, selective surface: Program-MAIN receives
operational events, while an owner channel should eventually receive only deduplicated,
acknowledgeable `needs-owner`, red, and important completion events. This channel does not build
that adapter or forward worker questions to the owner.
