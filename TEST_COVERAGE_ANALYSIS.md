# Test Coverage Analysis

## Overview

| Area | Source Files | Test Files | Coverage Gap |
|------|-------------|------------|--------------|
| **Backend** (`src/`) | 21 | 10 | 11 files untested directly |
| **Frontend** (`web/src/`) | 18 (excl. type defs) | 11 | 7 files untested |

---

## Critical Gaps (No Tests)

### 1. `src/services/transaction-upsert.ts` (79 lines) — **CRITICAL**

This service contains the core deduplication logic using PostgreSQL `INSERT ... ON CONFLICT` with a functional unique index (`date_trunc('day', date)`). Zero test coverage.

**Recommended tests:**
- New transaction inserts correctly
- Duplicate detection matches on (user_id, type, amount, date_trunc, description)
- Category field updates on conflict resolution
- NULL description handling via COALESCE()
- Concurrent upsert race conditions

### 2. `src/routes/categories.ts` (93 lines) — **HIGH**

Complete CRUD route (5 endpoints) with no test file at all.

**Recommended tests:**
- List/get/create/update/delete happy paths
- User isolation (user A cannot see user B's categories)
- 404 for non-existent category
- Cascading effects when deleting a category linked to transactions or rules

### 3. `web/src/lib/api.ts` (356 lines) — **HIGH**

The largest untested file in the codebase. Contains 27+ API client functions used across every page.

**Recommended tests:**
- Request formatting (correct URLs, methods, headers)
- Response parsing and error handling
- Auth token attachment
- Edge cases: network errors, 401 responses, malformed JSON

### 4. `web/src/hooks/useAuth.tsx` (137 lines) — **HIGH**

Core auth state management hook with login/register/logout mutations and cache management. Only tested indirectly through page-level tests.

**Recommended tests:**
- Login/register mutation flows
- Logout clears state and cache
- Loading/error states
- Auth state persistence across re-renders

### 5. `web/src/lib/currency.ts` (73 lines) — **MEDIUM**

Financial formatting utilities with no tests. Given this is a finance app, formatting correctness matters.

**Recommended tests:**
- `getCurrencySymbol()` for all 21 supported currencies
- `formatCurrency()` with various locales
- `formatCurrencyWithSign()` for income vs expense
- Edge cases: NaN, null, zero, very large numbers

### 6. `src/middleware/auth.ts` (115 lines) — **MEDIUM**

Authentication middleware with JWT and API token verification. Only tested indirectly.

**Recommended tests:**
- JWT verification and expiration
- API token verification (hash matching, expiration, revocation)
- `lastUsedAt` timestamp updates
- Missing/malformed token handling
- Mixed auth method precedence

### 7. `web/src/components/Layout.tsx` (76 lines) — **LOW**

Navigation layout component. Lower priority since it's primarily UI.

### 8. `web/src/pages/Setup.tsx` (130 lines) — **LOW**

Initial setup wizard page with no tests.

### 9. `web/src/routes/index.tsx` (148 lines) — **LOW**

Route definitions and auth guards. Could be tested to verify protected routes redirect unauthenticated users.

---

## Under-Tested Files (Tests Exist but Incomplete)

### 1. `src/routes/summary.ts` (202 lines)

Financial summary calculations with date aggregation. Tests exist (`tests/summary.test.ts`) but miss:
- Date range edge cases (leap years, DST, month boundaries)
- Running balance precision with large sums
- Empty data handling
- Weekly/monthly aggregation correctness

### 2. `src/routes/auth.ts` + `src/lib/auth.ts` (~216 lines combined)

Auth tests exist (`tests/auth.test.ts`) but are minimal. Missing:
- Logout endpoint testing
- `GET /auth/me` endpoint
- Password hashing/verification unit tests
- Cookie manipulation (set/clear/extract)
- Registration race condition (advisory lock)

### 3. `src/routes/skill.ts` (157 lines)

Tests exist (`tests/skill.test.ts`) but don't cover:
- API token creation with various expiration periods
- Token revocation
- Token hash generation and prefix handling

### 4. `web/src/pages/Settings.tsx` (397 lines) — Worst test-to-code ratio (38%)

Has tests but misses:
- API token create/revoke lifecycle
- SKILL.md download
- Copy-to-clipboard
- Currency selection persistence

### 5. `src/routes/ai.ts` (~150 lines)

Tests exist (`tests/ai.test.ts`) but miss:
- Rate limiting behavior (10 req/min)
- Command expiration (5-minute window)
- Confirmation workflow error cases

---

## Cross-Cutting Gaps

### Error Handling
No tests across the codebase for:
- Database connection failures
- Partial write failures / transaction rollbacks
- Constraint violation responses
- Graceful degradation under service unavailability

### Zod Schema Validation (`src/types/`)
Three type files (`index.ts`, `ai.ts`, `rules.ts` — 235 lines combined) define Zod schemas with no standalone validation tests. Invalid input rejection is only tested incidentally through route tests.

### Integration / E2E Tests
No end-to-end tests exist. Key user flows that would benefit:
- Register → create categories → add transactions → view summary
- AI assistant: natural language → parsed command → confirmation → execution
- Rule creation → automatic categorization of new transactions

---

## Recommended Priority Order

| Priority | File | Effort | Impact |
|----------|------|--------|--------|
| 1 | `src/services/transaction-upsert.ts` | Low | Critical — financial data deduplication |
| 2 | `src/routes/categories.ts` | Low | High — complete CRUD with zero coverage |
| 3 | `web/src/lib/currency.ts` | Low | Medium — financial formatting correctness |
| 4 | `src/middleware/auth.ts` | Medium | High — security-critical auth verification |
| 5 | `web/src/hooks/useAuth.tsx` | Medium | High — core state management |
| 6 | `src/routes/summary.ts` (expand) | Medium | Medium — financial calculation accuracy |
| 7 | `src/routes/auth.ts` (expand) | Medium | High — auth flow completeness |
| 8 | `web/src/lib/api.ts` | High | Medium — large surface but mostly thin wrappers |
| 9 | `web/src/pages/Settings.tsx` (expand) | Medium | Medium — token management |
| 10 | Error handling across all routes | High | Medium — reliability |
