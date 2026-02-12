# Service Field Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## 1) Create a service field (admin)

`POST {{BASE_URL}}/service-fields`

Permissions required: `service_field.create`

Body example (text field):

```json
{
  "serviceId": "{{serviceId}}",
  "label": "Location details",
  "type": "TEXTAREA",
  "placeholder": "Describe where the issue is",
  "required": true,
  "order": 1
}
```

Body example (file field):

```json
{
  "serviceId": "{{serviceId}}",
  "label": "Photo of the issue",
  "type": "FILE",
  "required": false,
  "order": 2
}
```

Test cases:

- Duplicate `label` within the same `serviceId` -> 400.
- Invalid `serviceId` -> 404 (service not found).

## 2) List fields for a service (community app)

`GET {{BASE_URL}}/service-fields?serviceId={{serviceId}}`

Permissions required: `service_field.read`

Expected:

- Array ordered by `order` ascending.

Test cases:

- Missing `serviceId` query -> 400.

## 3) Update a field (admin)

`PATCH {{BASE_URL}}/service-fields/{{fieldId}}`

Permissions required: `service_field.update`

Body examples:

```json
{ "required": false }
```

```json
{ "order": 10 }
```

## 4) Delete a field (admin)

`DELETE {{BASE_URL}}/service-fields/{{fieldId}}`

Permissions required: `service_field.delete`

Expected:

- If any `ServiceRequestFieldValue` rows exist for this field -> 400.
- Otherwise -> deleted.

