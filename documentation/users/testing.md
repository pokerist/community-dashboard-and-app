# Users Module - Postman Testing Guide

This file is meant to be used as a practical testing checklist for `src/modules/users` (admin user management).

## Postman environment variables

Recommended variables:

- `baseUrl` (example: `http://localhost:3000`)
- `adminToken`
- `userId`
- `residentId`
- `ownerId`
- `tenantId`
- `adminProfileId`

## Authentication

All routes require:

- Header: `Authorization: Bearer {{adminToken}}`

To get a token:

`POST {{baseUrl}}/auth/login`

```json
{ "email": "admin@example.com", "password": "password" }
```

## 1) Create user

`POST {{baseUrl}}/admin/users`

Body:

```json
{
  "nameEN": "Test User",
  "email": "test.user@example.com",
  "phone": "+201000000010",
  "password": "ChangeMe123",
  "roles": [],
  "signupSource": "dashboard"
}
```

Expected:

- `201/200` user object including relations (`roles`, `resident`, `owner`, `tenant`, `admin`).

Notes:

- If `signupSource` is `dashboard`, the caller must also have `user.create.direct` (service-level gate).

## 2) List users

`GET {{baseUrl}}/admin/users?skip=0&take=20`

Optional filter:

`GET {{baseUrl}}/admin/users?userType=owner`

Expected:

- `200` list ordered by `createdAt desc`.

## 3) Get user details

`GET {{baseUrl}}/admin/users/{{userId}}`

Expected:

- `200` full user with relations.

## 4) Update user (roles + password)

`PATCH {{baseUrl}}/admin/users/{{userId}}`

Body example:

```json
{
  "nameEN": "Updated Name",
  "roles": [],
  "password": "NewPassword123"
}
```

Expected:

- `200` updated user.

## 5) Deactivate user

`DELETE {{baseUrl}}/admin/users/{{userId}}`

Expected:

- `204`
- User’s `userStatus` becomes `DISABLED`.

## 6) Create resident profile

`POST {{baseUrl}}/admin/users/residents`

Body:

```json
{
  "userId": "{{userId}}",
  "nationalId": "12345678901234",
  "dateOfBirth": "1990-01-01"
}
```

Expected:

- `201` resident object including `user`.

Notes:

- Requires `user.create.direct` (service-level gate).

## 7) List residents

`GET {{baseUrl}}/admin/users/residents?skip=0&take=20`

Expected:

- `200` list including user objects.

## 8) Delete resident profile (use with caution)

`DELETE {{baseUrl}}/admin/users/residents/{{residentId}}`

Expected:

- `204`

Notes:

- The service deletes `ResidentUnit` and booking records for that resident, then deletes the resident profile.

## 9) Create owner / tenant / admin profiles

Owner:

- `POST {{baseUrl}}/admin/users/owners` with `{ "userId": "{{userId}}" }`

Tenant:

- `POST {{baseUrl}}/admin/users/tenants` with `{ "userId": "{{userId}}" }`

Admin:

- `POST {{baseUrl}}/admin/users/admins` with `{ "userId": "{{userId}}", "status": "ACTIVE" }`

Expected:

- `201` profile object including `user`.

