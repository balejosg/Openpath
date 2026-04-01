# ADR 0009: Transactional Service Writes

**Status:** Accepted  
**Date:** 2026-04-01  
**Decision Makers:** OpenPath maintainers

## Context

Several API flows used to perform multiple related writes without a transaction boundary. That allowed partial state such as approved requests without matching rule state, created users without matching role/setup rows, or group mutations that emitted downstream events before all DB writes were durable.

## Decision

OpenPath service flows that span more than one persistent write should use an explicit transaction boundary.

Rules:

- storage helpers may accept a transaction executor when they participate in a larger write
- services own the transaction boundary for multi-write flows
- external side effects run after commit, not inside the DB transaction

## Consequences

### Positive

- high-risk write paths are atomic
- service behavior is easier to reason about under failure
- side effects are aligned with committed state

### Negative

- storage helpers need a slightly wider calling convention
- tests must cover rollback/idempotent behavior more explicitly

### Neutral

- single-write flows can still use the root DB handle directly

## Alternatives Considered

- leave transactions only at the router layer: rejected because most multi-write composition lives in services
- introduce a larger unit-of-work framework: rejected as unnecessary overhead for the current codebase
