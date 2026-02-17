# Koin Finance API Skill

Manage personal finances through the Koin API.

## Configuration

```
API_URL: {{API_URL}}
API_TOKEN: {{API_TOKEN}}
```

## Authentication

All requests require the Bearer token:
```bash
curl -H "Authorization: Bearer $API_TOKEN" "$API_URL/endpoint"
```

## Endpoints

### Transactions

#### List Transactions
```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "$API_URL/transactions?startDate=2024-01-01&endDate=2024-12-31&type=expense"
```

Query params:
- `startDate` — ISO datetime filter (inclusive)
- `endDate` — ISO datetime filter (inclusive)
- `type` — `income` or `expense`
- `categoryId` — UUID of category

#### Create Transaction
```bash
curl -X POST -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/transactions" \
  -d '{
    "type": "expense",
    "amount": "25.50",
    "description": "Lunch at cafe",
    "categoryId": "uuid-here",
    "date": "2024-01-15T12:00:00Z"
  }'
```

Required: `type`, `amount`
Optional: `description`, `categoryId`, `date` (defaults to now)

#### Get Transaction
```bash
curl -H "Authorization: Bearer $API_TOKEN" "$API_URL/transactions/:id"
```

#### Update Transaction
```bash
curl -X PATCH -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/transactions/:id" \
  -d '{"amount": "30.00"}'
```

#### Delete Transaction
```bash
curl -X DELETE -H "Authorization: Bearer $API_TOKEN" "$API_URL/transactions/:id"
```

### Categories

#### List Categories
```bash
curl -H "Authorization: Bearer $API_TOKEN" "$API_URL/categories"
```

#### Create Category
```bash
curl -X POST -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/categories" \
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
curl -X PATCH -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/categories/:id" \
  -d '{"color": "#22c55e"}'
```

#### Delete Category
```bash
curl -X DELETE -H "Authorization: Bearer $API_TOKEN" "$API_URL/categories/:id"
```

### Summary

#### Get Financial Summary
```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "$API_URL/summary?startDate=2024-01-01&endDate=2024-01-31"
```

Returns:
```json
{
  "data": {
    "income": 5000.00,
    "expenses": 2500.00,
    "balance": 2500.00,
    "byCategory": [
      {"categoryId": "...", "categoryName": "Food", "total": "500.00", "count": 15}
    ]
  }
}
```

## Common Tasks

### Log an expense
```bash
curl -X POST -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/transactions" \
  -d '{"type": "expense", "amount": "15.00", "description": "Coffee"}'
```

### Log income
```bash
curl -X POST -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  "$API_URL/transactions" \
  -d '{"type": "income", "amount": "3000.00", "description": "Salary"}'
```

### Check this month's spending
```bash
START=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%dT00:00:00Z)
END=$(date +%Y-%m-%dT23:59:59Z)
curl -H "Authorization: Bearer $API_TOKEN" "$API_URL/summary?startDate=$START&endDate=$END"
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
2. The API_URL and API_TOKEN above are pre-configured for your account
3. Your agent can now manage your finances using the endpoints above

## Security Note

This file contains your personal API token. Keep it secure and don't share it.
If compromised, log out of all sessions from the Koin dashboard to invalidate tokens.
