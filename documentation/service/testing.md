# Service Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## 1) Create a service (admin)

`POST {{BASE_URL}}/services`

Permissions required: `service.create`

Body example:

```json
{
  "name": "Plumbing",
  "category": "MAINTENANCE",
  "unitEligibility": "ALL",
  "processingTime": 24,
  "description": "Plumbing maintenance and inspection",
  "status": true,
  "startingPrice": "150.00"
}
```

Test cases:

- Missing `name` -> 400 validation error.
- Invalid `category` -> 400 validation error.
- `startingPrice` with too many decimals -> 400 validation error.

## 2) List services (community app / dashboard)

`GET {{BASE_URL}}/services`

Permissions required: `service.read`

Query options:

- `?status=active` (default behavior in controller)
- `?status=inactive`
- `?status=all`

Expected:

- Array of services ordered by `name`.
- Each service includes `formFields` ordered by `order`.

## 3) Get a service by id

`GET {{BASE_URL}}/services/{{serviceId}}`

Permissions required: `service.read`

Expected:

- Service object including `formFields`.
- Unknown `serviceId` -> 404.

## 4) Update a service

`PATCH {{BASE_URL}}/services/{{serviceId}}`

Permissions required: `service.update`

Body examples:

Activate/deactivate:

```json
{ "status": false }
```

Update pricing:

```json
{ "startingPrice": "200.00" }
```

## 5) Delete a service (hard delete)

`DELETE {{BASE_URL}}/services/{{serviceId}}`

Permissions required: `service.delete`

Expected:

- If there are linked requests -> 400 with message telling you to set `status=false` instead.
- If the service has no requests -> deleted.
