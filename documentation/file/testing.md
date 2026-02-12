# File Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## Upload endpoints

All upload endpoints expect `multipart/form-data` with:

- key: `file`
- value: the binary file

Common validation:

- Profile photo: images only, max 2MB.
- Identity docs / attachments: images or PDF, max 5MB.

### 1) Upload profile photo

`POST {{BASE_URL}}/files/upload/profile-photo`

Expected: `{ id, key, name, mimeType, size }`

### 2) Upload national ID

`POST {{BASE_URL}}/files/upload/national-id`

### 3) Upload contract

`POST {{BASE_URL}}/files/upload/contract`

### 4) Upload service attachment

`POST {{BASE_URL}}/files/upload/service-attachment`

## Stream a file

`GET {{BASE_URL}}/files/{{fileId}}/stream`

Expected:

- 200 with binary stream if authorized.
- 403 if you don’t have access to the parent entity (or the file is not associated to anything you can access).
- 404 if the file doesn’t exist.

## Delete a file

`DELETE {{BASE_URL}}/files/{{fileId}}`

Expected:

- 200 success JSON.

Test cases:

- Deleting `NATIONAL_ID` category -> 400.
- Deleting a file you can’t access -> 403.

