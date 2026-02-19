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
- `type` — `income`, `expense`, or `adjustment`
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
- `type` — `income`, `expense`, or `adjustment`
- `amount` — positive for income/expense, positive or negative for adjustment

Optional: `description`, `categoryId`, `date` (defaults to now)

**Note:** Use `adjustment` type for balance corrections (e.g., starting balance, corrections). Positive values add to balance, negative values subtract.

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

### Set starting balance
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/transactions" \
  -d '{"type": "adjustment", "amount": "5000.00", "description": "Starting balance"}'
```

### Correct balance (negative adjustment)
```bash
curl -X POST -H "Authorization: Bearer $KOIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$KOIN_API_URL/transactions" \
  -d '{"type": "adjustment", "amount": "-50.00", "description": "Correction for missing expense"}'
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
