# Koin Finance API Skill

Manage personal finances through the Koin API.

## Configuration

Set these environment variables before using:
```bash
export KOIN_API_URL="{{API_URL}}"
export KOIN_API_TOKEN="<your-token-here>"
```

## Authentication

All requests require the Bearer token:
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/endpoint"
```

## Endpoints

### Transactions

#### List Transactions
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" \
  "$KOIN_API_URL/transactions?startDate=2024-01-01&endDate=2024-12-31&type=expense"
```

Query params:
- `startDate` — ISO datetime filter (inclusive)
- `endDate` — ISO datetime filter (inclusive)
- `type` — `income` or `expense`
- `categoryId` — UUID of category

#### Create Transaction
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/transactions" \
  -d '{
    "type": "expense",
    "amount": "25.50",
    "description": "Lunch at cafe",
    "categoryId": "uuid-here",
    "date": "2024-01-15T12:00:00Z"
  }'
```

Required: `type`, `amount`
- `type` — `income` or `expense`
- `amount` — positive decimal value

Optional: `description`, `categoryId`, `date` (defaults to now)

**Auto-categorization:** If `categoryId` is omitted and a matching category rule exists, the transaction will be automatically categorized. The response includes `appliedRuleId` showing which rule was applied (null if manually categorized or no match).

**Note:** For balance corrections or adjustments, use the Koin web UI.

#### Get Transaction
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/transactions/:id"
```

#### Update Transaction
```bash
curl -X PATCH -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/transactions/:id" \
  -d '{"amount": "30.00"}'
```

#### Delete Transaction
```bash
curl -X DELETE -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/transactions/:id"
```

### Categories

#### List Categories
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/categories"
```

#### Create Category
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/categories" \
  -d '{
    "name": "Food & Dining",
    "description": "Restaurants, groceries, coffee",
    "color": "#ef4444"
  }'
```

Required: `name`
Optional: `description`, `color` (hex format)

#### Update Category
```bash
curl -X PATCH -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/categories/:id" \
  -d '{"color": "#22c55e"}'
```

#### Delete Category
```bash
curl -X DELETE -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/categories/:id"
```

### Category Rules (Auto-Categorization)

Rules automatically categorize transactions based on conditions. When a transaction is created without a category, rules are evaluated in priority order (highest first) and the first match is applied.

#### List Rules
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/rules"
```

Returns rules sorted by priority (highest first).

#### Create Rule
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/rules" \
  -d '{
    "name": "Coffee shops",
    "categoryId": "uuid-of-food-category",
    "conditions": [
      {"field": "description", "operator": "contains", "value": "coffee"},
      {"field": "amount", "operator": "lt", "value": 100}
    ],
    "priority": 10,
    "enabled": true
  }'
```

Required: `name`, `categoryId`, `conditions` (non-empty array)
Optional: `priority` (default 0), `enabled` (default true)

**Condition types:**

| Field | Operator | Value | Description |
|-------|----------|-------|-------------|
| `description` | `contains` | string | Description includes value |
| `description` | `startsWith` | string | Description starts with value |
| `description` | `endsWith` | string | Description ends with value |
| `description` | `exact` | string | Description exactly matches value |
| `amount` | `eq` | number | Amount equals value |
| `amount` | `gt` | number | Amount greater than value |
| `amount` | `lt` | number | Amount less than value |
| `amount` | `gte` | number | Amount greater than or equal |
| `amount` | `lte` | number | Amount less than or equal |
| `amount` | `between` | number + `value2` | Amount in range [value, value2] |

Description conditions also support:
- `negate: true` — Inverts the match (e.g., does NOT contain)
- `caseSensitive: true` — Case-sensitive matching (default: case-insensitive)

All conditions in a rule are ANDed together (all must match).

#### Get Rule
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/rules/:id"
```

#### Update Rule
```bash
curl -X PUT -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/rules/:id" \
  -d '{"priority": 20, "enabled": false}'
```

All fields optional: `name`, `categoryId`, `conditions`, `priority`, `enabled`

#### Delete Rule
```bash
curl -X DELETE -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/rules/:id"
```

#### Test Rule (Dry Run)
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/rules/test" \
  -d '{
    "ruleId": "rule-uuid",
    "transaction": {"description": "GRAB TRANSPORT", "amount": 50000}
  }'
```

Returns per-condition results:
```json
{
  "matches": true,
  "rule": { ... },
  "conditionResults": [
    {"field": "description", "operator": "contains", "value": "GRAB", "matched": true},
    {"field": "amount", "operator": "lt", "value": 100000, "matched": true}
  ]
}
```

#### Apply Rule (Retroactive)
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/rules/:id/apply" \
  -d '{}'
```

Applies the rule to all existing uncategorized transactions. Returns:
```json
{
  "applied": 5,
  "transactions": [{ "id": "...", "categoryId": "...", "appliedRuleId": "..." }, ...]
}
```

#### Reorder Rules
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/rules/reorder" \
  -d '{"ruleIds": ["highest-priority-uuid", "second-uuid", "third-uuid"]}'
```

Assigns priority based on array order (first = highest). Returns all rules with updated priorities.

### Summary

#### Get Financial Summary
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" \
  "$KOIN_API_URL/summary?startDate=2024-01-01&endDate=2024-01-31"
```

Returns:
```json
{
  "data": {
    "income": 5000.00,
    "expenses": 2500.00,
    "adjustments": 100.00,
    "balance": 2600.00,
    "byCategory": [
      {"categoryId": "...", "categoryName": "Food", "total": "500.00", "count": 15}
    ]
  }
}
```

Balance formula: `income - expenses + adjustments`

Note: `adjustments` are balance corrections made via the web UI.

### AI Commands

Use natural language to bulk update transactions. Commands are staged for review before execution.

#### Create Command (Interpret & Preview)
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/ai/command" \
  -d '{"prompt": "Put all coffee expenses in Food category"}'
```

Returns:
```json
{
  "data": {
    "commandId": "uuid",
    "interpretation": "I'll categorize transactions containing 'coffee' as Food.",
    "preview": {
      "matchCount": 5,
      "records": [
        {
          "id": "tx-uuid",
          "before": {"description": "Coffee", "category": null, "amount": "5.50"},
          "after": {"description": "Coffee", "category": "Food", "amount": "5.50"}
        }
      ]
    },
    "expiresIn": 300
  }
}
```

#### Get Command Status
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/ai/command/:id"
```

#### Confirm Command (Execute)
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/ai/command/:id/confirm" \
  -d '{}'
```

Returns:
```json
{
  "data": {
    "commandId": "uuid",
    "status": "confirmed",
    "updatedCount": 5,
    "message": "Successfully updated 5 transaction(s)"
  }
}
```

#### Cancel Command
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/ai/command/:id/cancel" \
  -d '{}'
```

**Supported filters:** description, amount, amount range, date range, category name, transaction type

**Supported changes:** category, amount, description, type

**Rate limit:** 10 requests per minute per user

**Note:** Commands expire after 5 minutes (300 seconds) if not confirmed.

### Settings

#### Get User Settings
```bash
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/settings"
```

Returns:
```json
{
  "data": {
    "currency": "USD",
    "name": "John Doe"
  }
}
```

#### Update User Settings
```bash
curl -X PATCH -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/settings" \
  -d '{"currency": "EUR"}'
```

Optional fields: `currency` (3-char code, e.g., USD, EUR, IDR), `name`

## Common Tasks

### Log an expense
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/transactions" \
  -d '{"type": "expense", "amount": "15.00", "description": "Coffee"}'
```

### Log income
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/transactions" \
  -d '{"type": "income", "amount": "3000.00", "description": "Salary"}'
```

### Set up auto-categorization
```bash
# Create a rule: categorize "Grab" transactions as Transport
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/rules" \
  -d '{"name": "Grab rides", "categoryId": "transport-cat-uuid", "conditions": [{"field": "description", "operator": "contains", "value": "grab"}], "priority": 10}'

# Apply it to existing uncategorized transactions
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/rules/RULE_ID/apply" -d '{}'
```

### Check this month's spending
```bash
START=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%dT00:00:00Z)
END=$(date +%Y-%m-%dT23:59:59Z)
curl -H "Authorization: Bearer $KOIN_API_TOKEN" "$KOIN_API_URL/summary?startDate=$START&endDate=$END"
```

## Response Format

All responses follow:
```json
{
  "data": { ... }
}
```

Errors:
```json
{
  "error": "Error message or validation issues"
}
```

## Setup Instructions

1. Copy this file to your AI agent's workspace (e.g., `skills/koin/SKILL.md`)
2. The API_URL above is pre-configured for your account
3. Create an API token in Settings → API Tokens, then set KOIN_API_TOKEN
4. Your agent can now manage your finances using the endpoints above
