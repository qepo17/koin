# Koin Finance API Skill

Manage personal finances through the Koin API.

## Base URL

```
http://localhost:3000/api
```

Set via environment: `KOIN_API_URL`

## Authentication

None required (local API). Add auth header if configured:
```
Authorization: Bearer <token>
```

## Endpoints

### Transactions

#### List Transactions
```bash
curl "$KOIN_API_URL/transactions?startDate=2024-01-01&endDate=2024-12-31&type=expense"
```

Query params:
- `startDate` — ISO datetime filter (inclusive)
- `endDate` — ISO datetime filter (inclusive)
- `type` — `income` or `expense`
- `categoryId` — UUID of category

#### Create Transaction
```bash
curl -X POST "$KOIN_API_URL/transactions" \
  -H "Content-Type: application/json" \
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
curl "$KOIN_API_URL/transactions/:id"
```

#### Update Transaction
```bash
curl -X PATCH "$KOIN_API_URL/transactions/:id" \
  -H "Content-Type: application/json" \
  -d '{"amount": "30.00"}'
```

#### Delete Transaction
```bash
curl -X DELETE "$KOIN_API_URL/transactions/:id"
```

### Categories

#### List Categories
```bash
curl "$KOIN_API_URL/categories"
```

#### Create Category
```bash
curl -X POST "$KOIN_API_URL/categories" \
  -H "Content-Type: application/json" \
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
curl -X PATCH "$KOIN_API_URL/categories/:id" \
  -H "Content-Type: application/json" \
  -d '{"color": "#22c55e"}'
```

#### Delete Category
```bash
curl -X DELETE "$KOIN_API_URL/categories/:id"
```

### Summary

#### Get Financial Summary
```bash
curl "$KOIN_API_URL/summary?startDate=2024-01-01&endDate=2024-01-31"
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
# Quick expense (no category)
curl -X POST "$KOIN_API_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"type": "expense", "amount": "15.00", "description": "Coffee"}'
```

### Log income
```bash
curl -X POST "$KOIN_API_URL/transactions" \
  -H "Content-Type: application/json" \
  -d '{"type": "income", "amount": "3000.00", "description": "Salary"}'
```

### Check this month's spending
```bash
START=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%dT00:00:00Z)
END=$(date +%Y-%m-%dT23:59:59Z)
curl "$KOIN_API_URL/summary?startDate=$START&endDate=$END"
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

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — API port (default: 3000)
- `KOIN_API_URL` — Full API URL for clients (e.g., `http://localhost:3000/api`)
