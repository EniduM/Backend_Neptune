# NEPTUNE API HANDOVER DOCUMENT

**For: Flutter Developer (Collector and Rider Mobile Applications)**  
**Generated: 2026-08-13**  
**Backend Status: Production Ready**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Base URL & Environment](#base-url--environment)
3. [Authentication](#authentication)
4. [Roles & Authorization](#roles--authorization)
5. [Admin APIs](#admin-apis)
6. [Collector APIs](#collector-apis)
7. [Rider APIs](#rider-apis)
8. [Collection Workflow](#collection-workflow)
9. [Collection Record](#collection-record)
10. [HTTP Status Codes](#http-status-codes)
11. [Flutter Integration Guide](#flutter-integration-guide)
12. [Example Flows](#example-flows)
13. [Security Rules](#security-rules)
14. [Database Relationships](#database-relationships)
15. [API Quick Reference](#api-quick-reference)
16. [Local Development](#local-development)
17. [Backend Handover Status](#backend-handover-status)

---

## Project Overview

**Neptune** is a waste collection management system with the following components:

- **Backend**: NestJS REST API (TypeScript)
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens) with Argon2 password hashing
- **Framework**: NestJS 11 with Prisma ORM
- **Roles**: ADMIN, COLLECTOR, RIDER

The system manages:

- Waste collection requests initiated by Collectors
- Request acceptance and completion by Riders
- Collection tracking and record keeping
- Admin management of Collectors, Riders, and Vehicles

---

## Base URL & Environment

### Local Development

```
http://localhost:3000
```

**Port**: 3000 (configured in `src/main.ts`)

### Production URL

**Production**: https://neptune-backend-kappa.vercel.app

### Required Environment Variables

For backend setup, the following environment variables must be configured:

```
DATABASE_URL        # PostgreSQL connection string
JWT_SECRET          # Secret for signing JWT tokens (must be long and random)
```

**Example .env format:**

```
DATABASE_URL="postgresql://username:password@localhost:5432/neptune"
JWT_SECRET=your_long_random_secret_key_minimum_32_characters
```

**IMPORTANT:** Never commit `.env` files or include secrets in version control.

---

## Authentication

### POST /auth/login

Authenticates a user and returns a JWT access token.

**Method**: POST  
**URL**: `/auth/login`  
**Authentication**: Not required  
**Role**: Not required (any active user can login)

**Request Body**:

```json
{
  "loginId": "string",
  "password": "string"
}
```

**Validation Rules**:

- `loginId`: Required, string, max 100 characters
- `password`: Required, string, min 8 characters, max 128 characters

**Successful Response** (200 OK):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "loginId": "COLLECTOR001",
    "role": "COLLECTOR",
    "status": "ACTIVE"
  }
}
```

**Error Responses**:

- **401 Unauthorized**: Invalid loginId or password
- **401 Unauthorized**: User account is INACTIVE

**Token Details**:

- **Validity**: 15 minutes from issue time
- **Format**: JWT (Bearer token)
- **Payload Contains**: `sub` (userId), `loginId`, `role`

---

### GET /auth/me

Returns the currently authenticated user's information.

**Method**: GET  
**URL**: `/auth/me`  
**Authentication**: JWT required (Bearer token)  
**Role**: Not required

**Request Headers**:

```
Authorization: Bearer <accessToken>
```

**Successful Response** (200 OK):

For COLLECTOR role:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "COLLECTOR",
  "qrToken": "QR-COLLECTOR-002"
}
```

For ADMIN or RIDER role:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "role": "RIDER"
}
```

**Note**: The `qrToken` field is only included for COLLECTOR role. It is used by Riders to verify collector identity via QR scan.

**Error Responses**:

- **401 Unauthorized**: Missing or invalid JWT
- **401 Unauthorized**: JWT has expired (token validity is 15 minutes)

---

## Roles & Authorization

Neptune uses three user roles:

| Role          | Purpose                         | Access                   |
| ------------- | ------------------------------- | ------------------------ |
| **ADMIN**     | System administration           | All admin endpoints      |
| **COLLECTOR** | Waste collection initiation     | Collector endpoints only |
| **RIDER**     | Request acceptance & completion | Rider endpoints only     |

### Role-Based Access Control (RBAC)

Endpoints are protected by role. Attempting to access an endpoint with insufficient role returns **403 Forbidden**.

**Example**:

- ADMIN cannot call `/collector/collection-requests` → **403 Forbidden**
- COLLECTOR cannot call `/rider/collection-requests/my` → **403 Forbidden**
- RIDER cannot call `/admin/collectors` → **403 Forbidden**

### Ownership Checks

In addition to role checks, the backend verifies ownership:

- Collectors can only view/modify their own collection requests
- Riders can only view/modify requests assigned to them
- Identity is derived from the authenticated JWT, never from client input

---

## Admin APIs

All Admin endpoints require:

- **Authentication**: JWT required (Bearer token)
- **Authorization**: ADMIN role required
- **Identity**: Derived from JWT token

Base path: `/admin`

### Collector Management

#### POST /admin/collectors

Create a new Collector account.

**Method**: POST  
**URL**: `/admin/collectors`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Request Body**:

```json
{
  "loginId": "COLLECTOR002",
  "password": "SecurePass123",
  "fullName": "John Smith",
  "nic": "123456789V",
  "mobile": "0771234567",
  "address": "123 Main Street, Colombo",
  "guardianName": "Mary Smith",
  "guardianMobile": "0779876543",
  "qrToken": "QR-COLLECTOR-002"
}
```

**Validation Rules**:

- `loginId`: Required, string, max 100 chars, must be unique
- `password`: Required, min 8 chars, max 128 chars
- `fullName`: Required, string, max 200 chars
- `nic`: Required, string, max 50 chars, must be unique
- `mobile`: Required, string, max 30 chars
- `address`: Required, string, max 500 chars
- `guardianName`: Required, string, max 200 chars
- `guardianMobile`: Required, string, max 30 chars
- `qrToken`: Required, string, max 100 chars, must be unique

**Successful Response** (201 Created):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "loginId": "COLLECTOR002",
  "role": "COLLECTOR",
  "status": "ACTIVE",
  "createdAt": "2026-08-13T10:30:00Z",
  "updatedAt": "2026-08-13T10:30:00Z",
  "collector": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "nic": "123456789V",
    "mobile": "0771234567",
    "address": "123 Main Street, Colombo",
    "guardianName": "Mary Smith",
    "guardianMobile": "0779876543",
    "qrToken": "QR-COLLECTOR-002",
    "createdAt": "2026-08-13T10:30:00Z",
    "updatedAt": "2026-08-13T10:30:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "loginId": "COLLECTOR002",
      "role": "COLLECTOR",
      "status": "ACTIVE",
      "createdAt": "2026-08-13T10:30:00Z",
      "updatedAt": "2026-08-13T10:30:00Z"
    }
  }
}
```

**Error Responses**:

- **400 Bad Request**: Validation error (invalid field format)
- **401 Unauthorized**: No JWT provided
- **403 Forbidden**: User does not have ADMIN role
- **409 Conflict**: loginId, NIC, or qrToken already exists

---

#### GET /admin/collectors

List all Collectors.

**Method**: GET  
**URL**: `/admin/collectors`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Successful Response** (200 OK):

```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "nic": "123456789V",
    "mobile": "0771234567",
    "address": "123 Main Street, Colombo",
    "guardianName": "Mary Smith",
    "guardianMobile": "0779876543",
    "qrToken": "QR-COLLECTOR-002",
    "createdAt": "2026-08-13T10:30:00Z",
    "updatedAt": "2026-08-13T10:30:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "loginId": "COLLECTOR002",
      "role": "COLLECTOR",
      "status": "ACTIVE",
      "createdAt": "2026-08-13T10:30:00Z",
      "updatedAt": "2026-08-13T10:30:00Z"
    }
  }
]
```

**Ordering**: By creation date (newest first)

---

#### GET /admin/collectors/:id

Get a specific Collector.

**Method**: GET  
**URL**: `/admin/collectors/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Collector ID (UUID)

**Successful Response** (200 OK):  
Same structure as GET /admin/collectors (single object)

**Error Responses**:

- **404 Not Found**: Collector with specified ID does not exist

---

#### PATCH /admin/collectors/:id

Update Collector details.

**Method**: PATCH  
**URL**: `/admin/collectors/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Collector ID (UUID)

**Request Body** (all fields optional):

```json
{
  "loginId": "COLLECTOR002_NEW",
  "password": "NewSecurePass456",
  "fullName": "John Michael Smith",
  "nic": "123456789V",
  "mobile": "0771234567",
  "address": "456 Oak Avenue, Kandy",
  "guardianName": "Mary Anne Smith",
  "guardianMobile": "0779876543"
}
```

**Successful Response** (200 OK):  
Updated Collector object with same structure as POST response

**Error Responses**:

- **400 Bad Request**: Validation error
- **404 Not Found**: Collector not found
- **409 Conflict**: loginId or NIC already exists (duplicate)

---

#### PATCH /admin/collectors/:id/status

Update Collector account status.

**Method**: PATCH  
**URL**: `/admin/collectors/:id/status`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Collector ID (UUID)

**Request Body**:

```json
{
  "status": "INACTIVE"
}
```

**Valid Status Values**:

- `ACTIVE` - Account is active and can login
- `INACTIVE` - Account is inactive and cannot login

**Successful Response** (200 OK):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "loginId": "COLLECTOR002",
  "role": "COLLECTOR",
  "status": "INACTIVE",
  "createdAt": "2026-08-13T10:30:00Z",
  "updatedAt": "2026-08-13T10:30:00Z",
  "collector": { ... }
}
```

**Error Responses**:

- **400 Bad Request**: Invalid status value
- **404 Not Found**: Collector not found

---

### Rider Management

#### POST /admin/riders

Create a new Rider account.

**Method**: POST  
**URL**: `/admin/riders`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Request Body**:

```json
{
  "loginId": "RIDER001",
  "password": "RiderPass456",
  "fullName": "Jane Doe",
  "nic": "987654321V",
  "mobile": "0770123456",
  "address": "789 Pine Road, Galle"
}
```

**Validation Rules**:

- `loginId`: Required, string, max 100 chars, must be unique
- `password`: Required, min 8 chars, max 128 chars
- `fullName`: Required, string, max 200 chars
- `nic`: Required, string, max 50 chars, must be unique
- `mobile`: Required, string, max 30 chars
- `address`: Required, string, max 500 chars

**Successful Response** (201 Created):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "loginId": "RIDER001",
  "role": "RIDER",
  "status": "ACTIVE",
  "createdAt": "2026-08-13T10:31:00Z",
  "updatedAt": "2026-08-13T10:31:00Z",
  "rider": {
    "id": "770e8400-e29b-41d4-a716-446655440001",
    "fullName": "Jane Doe",
    "nic": "987654321V",
    "mobile": "0770123456",
    "address": "789 Pine Road, Galle",
    "createdAt": "2026-08-13T10:31:00Z",
    "updatedAt": "2026-08-13T10:31:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "loginId": "RIDER001",
      "role": "RIDER",
      "status": "ACTIVE",
      "createdAt": "2026-08-13T10:31:00Z",
      "updatedAt": "2026-08-13T10:31:00Z"
    }
  }
}
```

**Error Responses**:

- **400 Bad Request**: Validation error
- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not ADMIN role
- **409 Conflict**: loginId or NIC already exists

---

#### GET /admin/riders

List all Riders.

**Method**: GET  
**URL**: `/admin/riders`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Successful Response** (200 OK):  
Array of Rider objects (same structure as POST response)

**Ordering**: By creation date (newest first)

---

#### GET /admin/riders/:id

Get a specific Rider.

**Method**: GET  
**URL**: `/admin/riders/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Rider ID (UUID)

**Successful Response** (200 OK):  
Single Rider object

**Error Responses**:

- **404 Not Found**: Rider not found

---

#### PATCH /admin/riders/:id

Update Rider details.

**Method**: PATCH  
**URL**: `/admin/riders/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Rider ID (UUID)

**Request Body** (all fields optional):

```json
{
  "loginId": "RIDER001_NEW",
  "password": "NewRiderPass789",
  "fullName": "Jane Marie Doe",
  "mobile": "0770987654",
  "address": "999 Elm Street, Matara"
}
```

**Successful Response** (200 OK):  
Updated Rider object

**Error Responses**:

- **400 Bad Request**: Validation error
- **404 Not Found**: Rider not found
- **409 Conflict**: loginId or NIC already exists

---

#### PATCH /admin/riders/:id/status

Update Rider account status.

**Method**: PATCH  
**URL**: `/admin/riders/:id/status`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Rider ID (UUID)

**Request Body**:

```json
{
  "status": "ACTIVE"
}
```

**Valid Status Values**: `ACTIVE`, `INACTIVE`

**Successful Response** (200 OK):  
Updated Rider with status field

**Error Responses**:

- **400 Bad Request**: Invalid status
- **404 Not Found**: Rider not found

---

### Vehicle Management

#### POST /admin/vehicles

Create a new Vehicle.

**Method**: POST  
**URL**: `/admin/vehicles`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Request Body**:

```json
{
  "vehicleCode": "VEH-001",
  "vehicleType": "Tricycle"
}
```

**Validation Rules**:

- `vehicleCode`: Required, string, max 100 chars, must be unique
- `vehicleType`: Required, string, max 100 chars

**Successful Response** (201 Created):

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440001",
  "vehicleCode": "VEH-001",
  "vehicleType": "Tricycle",
  "status": "ACTIVE",
  "createdAt": "2026-08-13T10:32:00Z",
  "updatedAt": "2026-08-13T10:32:00Z"
}
```

**Error Responses**:

- **400 Bad Request**: Validation error
- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not ADMIN role
- **409 Conflict**: vehicleCode already exists

---

#### GET /admin/vehicles

List all Vehicles.

**Method**: GET  
**URL**: `/admin/vehicles`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Successful Response** (200 OK):  
Array of Vehicle objects

**Ordering**: By creation date (newest first)

---

#### GET /admin/vehicles/:id

Get a specific Vehicle.

**Method**: GET  
**URL**: `/admin/vehicles/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Vehicle ID (UUID)

**Successful Response** (200 OK):  
Single Vehicle object

**Error Responses**:

- **404 Not Found**: Vehicle not found

---

#### PATCH /admin/vehicles/:id

Update Vehicle details.

**Method**: PATCH  
**URL**: `/admin/vehicles/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Vehicle ID (UUID)

**Request Body** (all fields optional):

```json
{
  "vehicleCode": "VEH-001-NEW",
  "vehicleType": "Electric Tricycle"
}
```

**Successful Response** (200 OK):  
Updated Vehicle object

**Error Responses**:

- **400 Bad Request**: Validation error
- **404 Not Found**: Vehicle not found
- **409 Conflict**: vehicleCode already exists

---

#### PATCH /admin/vehicles/:id/status

Update Vehicle status.

**Method**: PATCH  
**URL**: `/admin/vehicles/:id/status`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Vehicle ID (UUID)

**Request Body**:

```json
{
  "status": "INACTIVE"
}
```

**Valid Status Values**: `ACTIVE`, `INACTIVE`

**Successful Response** (200 OK):  
Updated Vehicle with status

**Error Responses**:

- **400 Bad Request**: Invalid status
- **404 Not Found**: Vehicle not found

---

### Daily Assignment Management

#### POST /admin/assignments

Create a Daily Assignment.

**Method**: POST  
**URL**: `/admin/assignments`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Request Body**:

```json
{
  "collectorId": "660e8400-e29b-41d4-a716-446655440001",
  "assignmentDate": "2026-08-15"
}
```

**Validation Rules**:

- `collectorId`: Required, UUID format, Collector must exist
- `assignmentDate`: Required, date string format `YYYY-MM-DD`, must be a valid date

**Important**: Each Collector can have only one assignment per day. Duplicate assignments return 409 Conflict.

**Successful Response** (201 Created):

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440001",
  "collectorId": "660e8400-e29b-41d4-a716-446655440001",
  "assignmentDate": "2026-08-15",
  "createdAt": "2026-08-13T10:33:00Z",
  "updatedAt": "2026-08-13T10:33:00Z",
  "collector": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "mobile": "0771234567",
    "user": {
      "loginId": "COLLECTOR002"
    }
  }
}
```

**Error Responses**:

- **400 Bad Request**: Invalid date format or validation error
- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not ADMIN role
- **404 Not Found**: Collector does not exist
- **409 Conflict**: Assignment already exists for this Collector on this date

---

#### GET /admin/assignments

List all Assignments.

**Method**: GET  
**URL**: `/admin/assignments`  
**Authentication**: JWT required  
**Role**: ADMIN required

**Successful Response** (200 OK):  
Array of Assignment objects

**Ordering**: By assignment date (newest first)

---

#### GET /admin/assignments/:id

Get a specific Assignment.

**Method**: GET  
**URL**: `/admin/assignments/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Assignment ID (UUID)

**Successful Response** (200 OK):  
Single Assignment object

**Error Responses**:

- **404 Not Found**: Assignment not found

---

#### PATCH /admin/assignments/:id

Update Assignment.

**Method**: PATCH  
**URL**: `/admin/assignments/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Assignment ID (UUID)

**Request Body** (all fields optional):

```json
{
  "collectorId": "660e8400-e29b-41d4-a716-446655440002",
  "assignmentDate": "2026-08-16"
}
```

**Successful Response** (200 OK):  
Updated Assignment object

**Error Responses**:

- **400 Bad Request**: Invalid data
- **404 Not Found**: Assignment not found
- **409 Conflict**: Assignment already exists for new date/collector combination

---

#### DELETE /admin/assignments/:id

Delete an Assignment.

**Method**: DELETE  
**URL**: `/admin/assignments/:id`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Parameters**:

- `id`: Assignment ID (UUID)

**Successful Response** (200 OK):  
Deleted Assignment object (same structure as GET)

**Error Responses**:

- **404 Not Found**: Assignment not found

---

### GET /admin/leaderboard

Get collector leaderboard ranked by total collection weight.

**Method**: GET  
**URL**: `/admin/leaderboard`  
**Authentication**: JWT required  
**Role**: ADMIN required  
**Query Parameters**:

- `period` (optional): `"all"` (default) or `"month"`

**Aggregation**:

Leaderboard data is computed in real-time from the `Collection` table. For each Collector with completed collections:

- `totalWeightKg` = SUM of `weightKg` across all Collection records
- `totalCollections` = COUNT of Collection records

**Period Filtering**:

- `period=all` (default): Includes all Collection records regardless of date
- `period=month`: Only includes Collection records where `collectedAt` is within the current calendar month

**Ranking**:

- Primary: `totalWeightKg` descending
- Secondary (tiebreak): `totalCollections` descending
- Tertiary (tiebreak): `collectorId` ascending (alphabetical)

**Successful Response** (200 OK):

```json
[
  {
    "collectorId": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "totalWeightKg": 125.5,
    "totalCollections": 12,
    "rank": 1
  },
  {
    "collectorId": "660e8400-e29b-41d4-a716-446655440002",
    "fullName": "Jane Doe",
    "totalWeightKg": 87.3,
    "totalCollections": 8,
    "rank": 2
  }
]
```

**Empty Response** (200 OK):

Returns `[]` when no Collection records exist. This is a valid successful response.

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not ADMIN role

---

## Collector APIs

All Collector endpoints require:

- **Authentication**: JWT required (Bearer token)
- **Authorization**: COLLECTOR role required
- **Identity**: Derived from JWT token (Collector ID resolved via User → Collector relationship)

Base path: `/collector`

**Important**: All collector identity is derived from the authenticated JWT. The Collector ID is never accepted from the client.

### GET /collector/assignments/today

Get today's assignment for the authenticated Collector.

**Method**: GET  
**URL**: `/collector/assignments/today`  
**Authentication**: JWT required  
**Role**: COLLECTOR required

**Successful Response** (200 OK):

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440001",
  "assignmentDate": "2026-08-13",
  "createdAt": "2026-08-13T06:00:00Z",
  "updatedAt": "2026-08-13T06:00:00Z",
  "collector": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "mobile": "0771234567",
    "user": {
      "loginId": "COLLECTOR002"
    }
  }
}
```

**Error Responses**:

- **401 Unauthorized**: No JWT or expired JWT
- **403 Forbidden**: User is not COLLECTOR role
- **404 Not Found**: No assignment found for today

---

### POST /collector/collection-requests

Create a new Collection Request.

**Method**: POST  
**URL**: `/collector/collection-requests`  
**Authentication**: JWT required  
**Role**: COLLECTOR required

**Request Body**:

```json
{
  "latitude": 6.9271,
  "longitude": 80.7744
}
```

**Validation Rules**:

- `latitude`: Required, number, range -90 to 90
- `longitude`: Required, number, range -180 to 180

**Business Rule — One Active Request per Collector**:

A Collector may only have ONE active (non-terminal) Collection Request at a
time. *Active* means status `PENDING` or `ACCEPTED`. If the authenticated
Collector already has an active request, creation is rejected with **409
Conflict** and the existing request's `id` and `status` are returned so the
client can redirect the user straight to it:

```json
{
  "statusCode": 409,
  "message": "You already have an active collection request",
  "existingRequest": {
    "id": "aa0e8400-e29b-41d4-a716-446655440099",
    "status": "PENDING"
  }
}
```

The Collector must wait until their current request reaches `COMPLETED` or
`CANCELLED` before creating a new one.

**Successful Response** (201 Created):

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440001",
  "riderId": null,
  "latitude": 6.9271,
  "longitude": 80.7744,
  "status": "PENDING",
  "requestedAt": "2026-08-13T11:00:00Z",
  "createdAt": "2026-08-13T11:00:00Z",
  "updatedAt": "2026-08-13T11:00:00Z",
  "collector": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "mobile": "0771234567"
  }
}
```

**Status**: Initially `PENDING` (awaiting Rider acceptance)

**Error Responses**:

- **400 Bad Request**: Invalid coordinates
- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not COLLECTOR role
- **409 Conflict**: Collector already has an active request (`PENDING` or `ACCEPTED`) — response body includes the existing request's `id` and `status` (see Business Rule above)

---

### GET /collector/collection-requests

Get all Collection Requests created by the authenticated Collector.

**Method**: GET  
**URL**: `/collector/collection-requests`  
**Authentication**: JWT required  
**Role**: COLLECTOR required

**Successful Response** (200 OK):

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "status": "COMPLETED",
    "requestedAt": "2026-08-13T11:00:00Z",
    "acceptedAt": "2026-08-13T11:15:00Z",
    "completedAt": "2026-08-13T11:45:00Z",
    "cancelledAt": null,
    "createdAt": "2026-08-13T11:00:00Z",
    "updatedAt": "2026-08-13T11:45:00Z",
    "rider": {
      "id": "770e8400-e29b-41d4-a716-446655440001",
      "fullName": "Jane Doe",
      "mobile": "0770123456"
    }
  }
]
```

**Response Fields**:

- `id`: Unique Collection Request ID
- `latitude`: Location latitude
- `longitude`: Location longitude
- `status`: Current request status (PENDING, ACCEPTED, COMPLETED, CANCELLED)
- `requestedAt`: When request was created
- `acceptedAt`: When Rider accepted (null if not accepted)
- `completedAt`: When collection was completed (null if not completed)
- `cancelledAt`: When request was cancelled (null if not cancelled)
- `rider`: Assigned Rider information (null if not yet assigned)

**Ordering**: By request date (newest first)

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not COLLECTOR role

---

### GET /collector/collection-requests/:id

Get a specific Collection Request by ID.

**Method**: GET  
**URL**: `/collector/collection-requests/:id`  
**Authentication**: JWT required  
**Role**: COLLECTOR required  
**Parameters**:

- `id`: Collection Request ID (UUID)

**Successful Response** (200 OK):  
Same structure as GET /collector/collection-requests (single object)

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not COLLECTOR role
- **404 Not Found**: Request does not exist or is not owned by authenticated Collector

---

### PATCH /collector/collection-requests/:id/cancel

Cancel a Collection Request.

**Method**: PATCH  
**URL**: `/collector/collection-requests/:id/cancel`  
**Authentication**: JWT required  
**Role**: COLLECTOR required  
**Parameters**:

- `id`: Collection Request ID (UUID)

**Request Body**: Empty (no body required)

**Allowed State Transitions**:

- **PENDING** → **CANCELLED**: ✅ Success (200)

**Blocked State Transitions**:

- **ACCEPTED** → **CANCELLED**: ❌ 409 Conflict
- **COMPLETED** → **CANCELLED**: ❌ 409 Conflict
- **CANCELLED** → **CANCELLED**: ❌ 409 Conflict

**Successful Response** (200 OK):

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440001",
  "latitude": 6.9271,
  "longitude": 80.7744,
  "status": "CANCELLED",
  "requestedAt": "2026-08-13T11:00:00Z",
  "acceptedAt": null,
  "completedAt": null,
  "cancelledAt": "2026-08-13T11:05:00Z",
  "createdAt": "2026-08-13T11:00:00Z",
  "updatedAt": "2026-08-13T11:05:00Z",
  "rider": null
}
```

**Important**:

- No Collection record is created when cancelling
- Cancellation timestamp is recorded in `cancelledAt`

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not COLLECTOR role
- **404 Not Found**: Request not found or not owned
- **409 Conflict**: Request is not in PENDING status

---

### GET /collector/leaderboard

Get collector leaderboard ranked by total collection weight.

**Method**: GET  
**URL**: `/collector/leaderboard`  
**Authentication**: JWT required  
**Role**: COLLECTOR required  
**Query Parameters**:

- `period` (optional): `"all"` (default) or `"month"`

**Aggregation**:

Same logic as the Admin leaderboard. Data is computed in real-time from the `Collection` table. Returns the full cross-collector leaderboard (not filtered to the requesting collector).

**Period Filtering**:

- `period=all` (default): All Collection records
- `period=month`: Only current calendar month

**Ranking**:

- Primary: `totalWeightKg` descending
- Secondary (tiebreak): `totalCollections` descending
- Tertiary (tiebreak): `collectorId` ascending

**Successful Response** (200 OK):

```json
[
  {
    "collectorId": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "totalWeightKg": 125.5,
    "totalCollections": 12,
    "rank": 1
  }
]
```

**Empty Response** (200 OK):

Returns `[]` when no Collection records exist.

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not COLLECTOR role
- **404 Not Found**: Collector profile not found

---

## Rider APIs

All Rider endpoints require:

- **Authentication**: JWT required (Bearer token)
- **Authorization**: RIDER role required
- **Identity**: Derived from JWT token (Rider ID resolved via User → Rider relationship)

Base path: `/rider`

**Important**: All Rider identity is derived from the authenticated JWT. The Rider ID is never accepted from the client.

### GET /rider/collection-requests

Get all pending (unassigned) Collection Requests.

**Method**: GET  
**URL**: `/rider/collection-requests`  
**Authentication**: JWT required  
**Role**: RIDER required

**Purpose**: Browse available requests to accept

**Successful Response** (200 OK):

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "collectorId": "660e8400-e29b-41d4-a716-446655440001",
    "riderId": null,
    "latitude": 6.9271,
    "longitude": 80.7744,
    "status": "PENDING",
    "requestedAt": "2026-08-13T11:00:00Z",
    "acceptedAt": null,
    "completedAt": null,
    "cancelledAt": null,
    "createdAt": "2026-08-13T11:00:00Z",
    "updatedAt": "2026-08-13T11:00:00Z",
    "collector": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "fullName": "John Smith",
      "mobile": "0771234567"
    }
  }
]
```

**Filter**: Only requests with status `PENDING` are returned

**Ordering**: By request date (oldest first)

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not RIDER role

---

### GET /rider/collection-requests/my

Get all Collection Requests assigned to the authenticated Rider.

**Method**: GET  
**URL**: `/rider/collection-requests/my`  
**Authentication**: JWT required  
**Role**: RIDER required

**Purpose**: View all requests assigned to this Rider (any status)

**Successful Response** (200 OK):

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "collectorId": "660e8400-e29b-41d4-a716-446655440001",
    "riderId": "770e8400-e29b-41d4-a716-446655440001",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "status": "ACCEPTED",
    "requestedAt": "2026-08-13T11:00:00Z",
    "acceptedAt": "2026-08-13T11:15:00Z",
    "completedAt": null,
    "cancelledAt": null,
    "createdAt": "2026-08-13T11:00:00Z",
    "updatedAt": "2026-08-13T11:15:00Z",
    "collector": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "fullName": "John Smith",
      "mobile": "0771234567"
    }
  }
]
```

**Filter**: Only requests where `riderId` = authenticated Rider ID

**Ordering**: By request date (newest first)

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not RIDER role

---

### GET /rider/collection-requests/:id

Get a specific Collection Request assigned to the authenticated Rider.

**Method**: GET  
**URL**: `/rider/collection-requests/:id`  
**Authentication**: JWT required  
**Role**: RIDER required  
**Parameters**:

- `id`: Collection Request ID (UUID)

**Successful Response** (200 OK):  
Same structure as GET /rider/collection-requests/my (single object)

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not RIDER role
- **404 Not Found**: Request does not exist or is not assigned to authenticated Rider

---

### PATCH /rider/collection-requests/:id/accept

Accept a pending Collection Request.

**Method**: PATCH  
**URL**: `/rider/collection-requests/:id/accept`  
**Authentication**: JWT required  
**Role**: RIDER required  
**Parameters**:

- `id`: Collection Request ID (UUID)

**Request Body**: Empty (no body required)

**State Transition**:

- **PENDING** → **ACCEPTED**: ✅ Success (200)

**Successful Response** (200 OK):

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440001",
  "collectorId": "660e8400-e29b-41d4-a716-446655440001",
  "riderId": "770e8400-e29b-41d4-a716-446655440001",
  "latitude": 6.9271,
  "longitude": 80.7744,
  "status": "ACCEPTED",
  "requestedAt": "2026-08-13T11:00:00Z",
  "acceptedAt": "2026-08-13T11:15:00Z",
  "completedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-08-13T11:00:00Z",
  "updatedAt": "2026-08-13T11:15:00Z",
  "collector": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "mobile": "0771234567"
  }
}
```

**Important**:

- `riderId` is set to the authenticated Rider ID
- `acceptedAt` timestamp is recorded
- Status changes to `ACCEPTED`

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not RIDER role
- **404 Not Found**: Request not found
- **409 Conflict**: Request is not in PENDING status

---

### POST /rider/collection-requests/:id/verify-qr-token

Verify a collector's QR token before completing a collection request.

**Method**: POST  
**URL**: `/rider/collection-requests/:id/verify-qr-token`  
**Authentication**: JWT required  
**Role**: RIDER required  
**Parameters**:

- `id`: Collection Request ID (UUID)

**Request Body**:

```json
{
  "qrToken": "QR-COLLECTOR-002"
}
```

**Validation Rules**:

- `qrToken`: Required, string, must match the collector's qrToken exactly

**State Transition**:

- Request must be in **ACCEPTED** status and owned by the authenticated Rider
- Sets `qrVerified` to `true` on the CollectionRequest

**Successful Response** (200 OK):

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440001",
  "collectorId": "660e8400-e29b-41d4-a716-446655440001",
  "riderId": "770e8400-e29b-41d4-a716-446655440001",
  "latitude": 6.9271,
  "longitude": 80.7744,
  "status": "ACCEPTED",
  "qrVerified": true,
  "requestedAt": "2026-08-13T11:00:00Z",
  "acceptedAt": "2026-08-13T11:15:00Z",
  "completedAt": null,
  "cancelledAt": null,
  "createdAt": "2026-08-13T11:00:00Z",
  "updatedAt": "2026-08-13T11:30:00Z",
  "collector": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Smith",
    "mobile": "0771234567"
  }
}
```

**Important**:

- The `qrToken` must match the collector's QR token (set during collector creation by Admin)
- Once `qrVerified` is `true`, the Rider can call `POST /rider/collection-requests/:id/complete`
- QR verification is a **prerequisite** for collection completion — `complete` will return 409 if `qrVerified` is `false`

**Error Responses**:

- **401 Unauthorized**: No JWT or invalid QR token
- **403 Forbidden**: Not RIDER role or request not assigned to this Rider
- **404 Not Found**: Request not found
- **409 Conflict**: Request is not in ACCEPTED status

---

### GET /rider/vehicles

Get all active vehicles.

**Method**: GET  
**URL**: `/rider/vehicles`  
**Authentication**: JWT required  
**Role**: RIDER required

**Purpose**: Riders need to select a vehicle when completing a collection request

**Successful Response** (200 OK):

```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "vehicleCode": "VEH-001",
    "vehicleType": "Tricycle",
    "status": "ACTIVE",
    "createdAt": "2026-08-13T10:32:00Z",
    "updatedAt": "2026-08-13T10:32:00Z"
  },
  {
    "id": "880e8400-e29b-41d4-a716-446655440002",
    "vehicleCode": "VEH-002",
    "vehicleType": "Van",
    "status": "ACTIVE",
    "createdAt": "2026-08-13T10:32:00Z",
    "updatedAt": "2026-08-13T10:32:00Z"
  }
]
```

**Filter**: Only vehicles with status `ACTIVE` are returned

**Ordering**: By vehicleCode (ascending)

**Error Responses**:

- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not RIDER role

---

### POST /rider/collection-requests/:id/complete

Complete a Collection Request.

**Method**: POST  
**URL**: `/rider/collection-requests/:id/complete`  
**Authentication**: JWT required  
**Role**: RIDER required  
**Parameters**:

- `id`: Collection Request ID (UUID)

**Request Body**:

```json
{
  "vehicleId": "880e8400-e29b-41d4-a716-446655440001",
  "weightKg": 45.5
}
```

**Validation Rules**:

- `vehicleId`: Required, UUID format, Vehicle must exist and be ACTIVE
- `weightKg`: Required, number, must be positive (> 0)

**State Transition**:

- **ACCEPTED** → **COMPLETED**: ✅ Success (200)
- **Precondition**: `qrVerified` must be `true` (use `POST /rider/collection-requests/:id/verify-qr-token` first)

**Successful Response** (200 OK):

```json
{
  "request": {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "collectorId": "660e8400-e29b-41d4-a716-446655440001",
    "riderId": "770e8400-e29b-41d4-a716-446655440001",
    "latitude": 6.9271,
    "longitude": 80.7744,
    "status": "COMPLETED",
    "requestedAt": "2026-08-13T11:00:00Z",
    "acceptedAt": "2026-08-13T11:15:00Z",
    "completedAt": "2026-08-13T11:45:00Z",
    "cancelledAt": null,
    "createdAt": "2026-08-13T11:00:00Z",
    "updatedAt": "2026-08-13T11:45:00Z",
    "collector": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "fullName": "John Smith",
      "mobile": "0771234567"
    }
  },
  "collection": {
    "id": "bb0e8400-e29b-41d4-a716-446655440001",
    "collectionRequestId": "aa0e8400-e29b-41d4-a716-446655440001",
    "collectorId": "660e8400-e29b-41d4-a716-446655440001",
    "riderId": "770e8400-e29b-41d4-a716-446655440001",
    "vehicleId": "880e8400-e29b-41d4-a716-446655440001",
    "weightKg": 45.5,
    "collectedAt": "2026-08-13T11:45:00Z",
    "createdAt": "2026-08-13T11:45:00Z",
    "updatedAt": "2026-08-13T11:45:00Z",
    "vehicle": {
      "id": "880e8400-e29b-41d4-a716-446655440001",
      "vehicleCode": "VEH-001",
      "vehicleType": "Tricycle"
    }
  }
}
```

**Transaction Guarantee**: This operation is transactional. Either both the CollectionRequest and Collection are created together, or the entire operation is rolled back.

**Error Responses**:

- **400 Bad Request**: Invalid data
- **401 Unauthorized**: No JWT
- **403 Forbidden**: Not RIDER role or request not assigned to this Rider
- **404 Not Found**: Request or Vehicle not found
- **409 Conflict**: Request is not ACCEPTED, Vehicle is INACTIVE, or Collection already created

---

## Collection Workflow

### Complete Collection Lifecycle

```
ADMIN Creates Daily Assignment
    ↓
COLLECTOR Logs in
    ↓
COLLECTOR Checks assignment for today (GET /collector/assignments/today)
    ↓
COLLECTOR Creates Collection Request (POST /collector/collection-requests)
    ↓
Request Status: PENDING
    ↓
RIDER Logs in
    ↓
RIDER Browses pending requests (GET /rider/collection-requests)
    ↓
RIDER Accepts request (PATCH /rider/collection-requests/:id/accept)
    ↓
Request Status: ACCEPTED
    ↓
RIDER Gets collector's QR token (GET /auth/me → qrToken for COLLECTOR)
    ↓
RIDER Verifies collector QR (POST /rider/collection-requests/:id/verify-qr-token)
    ↓
Request qrVerified: true
    ↓
RIDER Completes collection (POST /rider/collection-requests/:id/complete)
    ↓
Request Status: COMPLETED
Collection Record Created
```

### Cancellation Flow

```
Request Status: PENDING
    ↓
COLLECTOR Cancels request (PATCH /collector/collection-requests/:id/cancel)
    ↓
Request Status: CANCELLED
No Collection record created
```

### Invalid Transitions (Rejected with 409 Conflict)

- ACCEPTED → CANCELLED (Collector cannot cancel after Rider accepted)
- COMPLETED → CANCELLED (Cannot cancel after completion)
- ACCEPTED → PENDING (No reverting to PENDING)

---

## Collection Record

When a Rider completes a Collection Request, a Collection record is automatically created.

### Collection Fields

| Field                 | Type     | Description                             |
| --------------------- | -------- | --------------------------------------- |
| `id`                  | UUID     | Unique collection ID                    |
| `collectionRequestId` | UUID     | Link to CollectionRequest               |
| `collectorId`         | UUID     | Collector who created the request       |
| `riderId`             | UUID     | Rider who completed the collection      |
| `vehicleId`           | UUID     | Vehicle used for collection             |
| `weightKg`            | Decimal  | Weight of waste collected (kg)          |
| `collectedAt`         | DateTime | Timestamp when collection was completed |
| `createdAt`           | DateTime | Record creation timestamp               |
| `updatedAt`           | DateTime | Last update timestamp                   |

### Collection Response Example

See the `collection` object in POST /rider/collection-requests/:id/complete response above.

### Transactional Guarantee

The collection operation is transactional:

- Collection Request status updates to COMPLETED
- Collection record is created
- Both operations succeed or both are rolled back

If the transaction fails, the CollectionRequest remains in ACCEPTED status and no Collection record is created.

---

## HTTP Status Codes

The Neptune API uses the following HTTP status codes:

| Code    | Status       | Usage                                           |
| ------- | ------------ | ----------------------------------------------- |
| **200** | OK           | Successful GET, PATCH, DELETE operations        |
| **201** | Created      | Successful POST operations (resource created)   |
| **400** | Bad Request  | Invalid request format or validation error      |
| **401** | Unauthorized | Missing or invalid JWT, expired token           |
| **403** | Forbidden    | Authenticated but insufficient role/permissions |
| **404** | Not Found    | Resource does not exist or not owned by user    |
| **409** | Conflict     | Invalid state transition or duplicate resource  |

### Common Error Scenarios

**400 Bad Request**:

- Invalid JSON format
- Missing required fields
- Invalid field values (e.g., coordinates out of range)
- Date format incorrect (should be YYYY-MM-DD)

**401 Unauthorized**:

- No `Authorization` header provided
- JWT is malformed or invalid
- JWT has expired (validity: 15 minutes)
- User status is INACTIVE

**403 Forbidden**:

- User has correct role but trying to access cross-role endpoint
- Example: ADMIN accessing COLLECTOR endpoints

**404 Not Found**:

- Resource ID does not exist in database
- Resource exists but not owned by authenticated user
- Example: Rider trying to access another Rider's assigned request

**409 Conflict**:

- Duplicate unique constraint violation (loginId, NIC, vehicleCode, etc.)
- Invalid state transition (e.g., trying to cancel COMPLETED request)
- Assignment already exists for Collector on that date
- Collection already created for request

---

## Flutter Integration Guide

### 1. Authentication

**Step 1: Login**

```
POST /auth/login
Body: { "loginId": "...", "password": "..." }
```

Store the returned `accessToken` securely (use device secure storage).

**Step 2: Include Token in Requests**

For all protected endpoints, add header:

```
Authorization: Bearer <accessToken>
```

**Step 3: Handle Token Expiry**

Tokens expire after 15 minutes. When you receive a 401 response:

1. Prompt user to login again
2. Repeat login to get new token
3. Retry the original request

### 2. Collector Mobile App Flow

```
1. Login (POST /auth/login)
2. Check today's assignment (GET /collector/assignments/today)
   - If 404: No assignment today
   - If 200: Review assignment
3. Create collection requests (POST /collector/collection-requests)
   - Repeat for each collection point
4. View request history (GET /collector/collection-requests)
   - Monitor request statuses
5. Cancel requests if needed (PATCH /collector/collection-requests/:id/cancel)
   - Only PENDING requests can be cancelled
```

### 3. Rider Mobile App Flow

```
1. Login (POST /auth/login)
2. Browse available requests (GET /rider/collection-requests)
   - List all PENDING requests
3. Accept request (PATCH /rider/collection-requests/:id/accept)
   - Now assigned to you
4. View your requests (GET /rider/collection-requests/my)
   - See all requests assigned to you
5. Verify collector QR (POST /rider/collection-requests/:id/verify-qr-token)
   - Scan collector's QR or enter QR token
   - Requires ACCEPTED status and matching token
6. Get available vehicles (GET /rider/vehicles)
   - Select vehicle for collection
7. Complete collection (POST /rider/collection-requests/:id/complete)
   - Provide vehicle and weight
   - Creates Collection record
   - Requires qrVerified = true
```

### 4. Error Handling

**Implement error handling for each status code**:

```
200/201: Success - Process response
400: Show validation error to user
401: Redirect to login
403: Show "Access Denied" message
404: Show "Not found" message
409: Show specific conflict message
```

### 5. Data Storage

**Collector App should cache**:

- Today's assignment (with expiry)
- User profile (cache from /auth/me)
- List of active requests (refresh periodically)

**Rider App should cache**:

- Available requests list (refresh frequently - new requests may appear)
- User profile
- Assigned requests list

### 6. Polling/Refresh Strategy

**Collector**: Periodically poll collection request status

- Check if Rider has accepted (status changed to ACCEPTED)
- Check if collection completed (status changed to COMPLETED)

**Rider**:

- Poll available requests list (every 30-60 seconds)
- Poll own requests to see if any completed

### 7. Location Features

Both apps use latitude/longitude:

**Collector**:

- Capture GPS coordinates when creating request
- Validation: -90 to 90 for latitude, -180 to 180 for longitude

**Rider**:

- Receive coordinates from request
- Use coordinates for navigation to collection point

### 8. Status Management

Track and display request status:

```
PENDING     → Awaiting Rider acceptance
ACCEPTED    → Rider accepted, collection in progress
COMPLETED   → Collection completed, recorded
CANCELLED   → Request cancelled by Collector
```

Update UI based on current status.

### 9. Error Recovery

On failed requests:

1. Check if 401: User needs to re-login
2. Check if 403: User role mismatch (app should only allow appropriate roles)
3. Check if 404: Resource was deleted/moved
4. Check if 409: State conflict - refresh data and retry
5. For network errors: Implement retry with exponential backoff

---

## Example Flows

### Collector: Complete Request Lifecycle

```http
POST /auth/login
{
  "loginId": "COLLECTOR001",
  "password": "SecurePass123"
}

→ 200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "col-123", "role": "COLLECTOR" }
}

---

GET /collector/assignments/today
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

→ 200 OK
{
  "id": "assign-001",
  "collectorId": "col-123",
  "assignmentDate": "2026-08-13"
}

---

POST /collector/collection-requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
{
  "latitude": 6.9271,
  "longitude": 80.7744
}

→ 201 Created
{
  "id": "req-001",
  "status": "PENDING",
  "latitude": 6.9271,
  "longitude": 80.7744
}

---

GET /collector/collection-requests/req-001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

→ 200 OK
{
  "id": "req-001",
  "status": "ACCEPTED",
  "rider": { "fullName": "Jane Doe", "mobile": "0770123456" }
}

(Later, after Rider completes)

→ 200 OK
{
  "id": "req-001",
  "status": "COMPLETED",
  "completedAt": "2026-08-13T11:45:00Z"
}
```

### Rider: Accept, Verify, and Complete Request

```http
POST /auth/login
{
  "loginId": "RIDER001",
  "password": "RiderPass456"
}

→ 200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "rider-001", "role": "RIDER" }
}

---

GET /rider/collection-requests
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

→ 200 OK
[
  {
    "id": "req-001",
    "status": "PENDING",
    "collector": { "fullName": "John Smith" },
    "latitude": 6.9271,
    "longitude": 80.7744
  }
]

---

PATCH /rider/collection-requests/req-001/accept
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

→ 200 OK
{
  "id": "req-001",
  "status": "ACCEPTED",
  "riderId": "rider-001"
}

---

POST /rider/collection-requests/req-001/verify-qr-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
{
  "qrToken": "QR-COLLECTOR-002"
}

→ 200 OK
{
  "id": "req-001",
  "status": "ACCEPTED",
  "qrVerified": true
}

---

GET /rider/vehicles
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

→ 200 OK
[
  { "id": "veh-001", "vehicleCode": "VEH-001", "vehicleType": "Tricycle" }
]

---

POST /rider/collection-requests/req-001/complete
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
{
  "vehicleId": "veh-001",
  "weightKg": 45.5
}

→ 200 OK
{
  "request": {
    "id": "req-001",
    "status": "COMPLETED",
    "completedAt": "2026-08-13T11:45:00Z"
  },
  "collection": {
    "id": "coll-001",
    "weightKg": 45.5,
    "vehicle": { "vehicleCode": "VEH-001" }
  }
}
```

---

## Security Rules

The following security rules are enforced by the Neptune backend:

1. **JWT Required**: All endpoints except `/auth/login` require a valid JWT in the `Authorization: Bearer` header

2. **Role-Based Access Control**:
   - ADMIN endpoints (`/admin/*`) only accessible to ADMIN role
   - COLLECTOR endpoints (`/collector/*`) only accessible to COLLECTOR role
   - RIDER endpoints (`/rider/*`) only accessible to RIDER role

3. **User Identity from JWT**:
   - User ID is extracted from JWT `sub` claim
   - Collector ID is resolved from User → Collector relationship
   - Rider ID is resolved from User → Rider relationship
   - Never accept these values from client request body or query parameters

4. **Ownership Verification**:
   - Collectors can only view/modify their own collection requests
   - Riders can only view/modify requests assigned to them
   - If resource is not owned, API returns 404 (not 403) to prevent information leakage

5. **Password Security**:
   - Passwords are hashed using Argon2
   - Hashed passwords are never returned in API responses
   - Minimum password length: 8 characters
   - Maximum password length: 128 characters

6. **Unique Constraints**:
   - loginId must be unique per User
   - NIC (National ID) must be unique per Collector/Rider
   - vehicleCode must be unique per Vehicle
   - qrToken must be unique per Collector
   - Each Collector can have only one assignment per calendar day

7. **Status Validation**:
   - Only ACTIVE users can login
   - Inactive users receive 401 Unauthorized
   - INACTIVE vehicles cannot be used for collections (409 Conflict)

8. **State Machine Enforcement**:
   - Collection Request can only transition between specific states
   - Invalid transitions are blocked with 409 Conflict
   - No arbitrary status changes allowed

9. **Token Expiration**:
   - JWT tokens expire after 15 minutes
   - Expired tokens return 401 Unauthorized
   - Client must re-login to get new token

10. **No Data Leakage**:
    - User password hashes never included in responses
    - Ownership checks prevent accessing other users' data
    - 404 returned instead of 403 for non-owned resources

---

## Database Relationships

### Entity Relationship Overview

```
User (Central)
├── Collector (1-to-1)
│   ├── DailyAssignment (1-to-many)
│   ├── CollectionRequest (1-to-many, as creator)
│   └── Collection (1-to-many)
├── Rider (1-to-1)
│   ├── CollectionRequest (1-to-many, as acceptor)
│   └── Collection (1-to-many)

Vehicle (Independent)
└── Collection (1-to-many)

CollectionRequest (Central to workflow)
├── Collector (many-to-1, who created)
├── Rider (many-to-1, who accepted, optional)
└── Collection (1-to-1, when completed)

DailyAssignment
└── Collector (many-to-1)

Collection
├── CollectionRequest (1-to-1)
├── Collector (many-to-1)
├── Rider (many-to-1)
└── Vehicle (many-to-1)
```

### Key Relationships

**User → Collector/Rider**:

- One-to-one relationship
- User deletion cascades to Collector/Rider
- Each User has either a Collector or Rider profile (or neither if ADMIN)

**Collector → CollectionRequest**:

- One-to-many relationship
- Collector creates requests
- Deletion of Collector restricts deletion (cannot delete if has active requests)

**Rider → CollectionRequest**:

- One-to-many relationship
- Rider accepts requests (optional: riderId can be null initially)
- Deletion of Rider restricts deletion

**CollectionRequest → Collection**:

- One-to-one relationship
- Collection created when request is completed
- Deletion of request restricts collection deletion

**Vehicle → Collection**:

- One-to-many relationship
- Multiple collections can use same vehicle

---

## API Quick Reference

| Method     | Endpoint                                        | Role      | Purpose                      |
| ---------- | ----------------------------------------------- | --------- | ---------------------------- |
| **POST**   | `/auth/login`                                   | -         | Authenticate and get token   |
| **GET**    | `/auth/me`                                      | Any       | Get current user info        |
| **POST**   | `/admin/collectors`                             | ADMIN     | Create Collector             |
| **GET**    | `/admin/collectors`                             | ADMIN     | List all Collectors          |
| **GET**    | `/admin/collectors/:id`                         | ADMIN     | Get specific Collector       |
| **PATCH**  | `/admin/collectors/:id`                         | ADMIN     | Update Collector             |
| **PATCH**  | `/admin/collectors/:id/status`                  | ADMIN     | Change Collector status      |
| **POST**   | `/admin/riders`                                 | ADMIN     | Create Rider                 |
| **GET**    | `/admin/riders`                                 | ADMIN     | List all Riders              |
| **GET**    | `/admin/riders/:id`                             | ADMIN     | Get specific Rider           |
| **PATCH**  | `/admin/riders/:id`                             | ADMIN     | Update Rider                 |
| **PATCH**  | `/admin/riders/:id/status`                      | ADMIN     | Change Rider status          |
| **POST**   | `/admin/vehicles`                               | ADMIN     | Create Vehicle               |
| **GET**    | `/admin/vehicles`                               | ADMIN     | List all Vehicles            |
| **GET**    | `/admin/vehicles/:id`                           | ADMIN     | Get specific Vehicle         |
| **PATCH**  | `/admin/vehicles/:id`                           | ADMIN     | Update Vehicle               |
| **PATCH**  | `/admin/vehicles/:id/status`                    | ADMIN     | Change Vehicle status        |
| **POST**   | `/admin/assignments`                            | ADMIN     | Create Daily Assignment      |
| **GET**    | `/admin/assignments`                            | ADMIN     | List all Assignments         |
| **GET**    | `/admin/assignments/:id`                        | ADMIN     | Get specific Assignment      |
| **PATCH**  | `/admin/assignments/:id`                        | ADMIN     | Update Assignment            |
| **DELETE** | `/admin/assignments/:id`                        | ADMIN     | Delete Assignment            |
| **GET**    | `/admin/leaderboard`                            | ADMIN     | Get collector leaderboard    |
| **GET**    | `/collector/assignments/today`                  | COLLECTOR | Get today's assignment       |
| **POST**   | `/collector/collection-requests`                | COLLECTOR | Create collection request    |
| **GET**    | `/collector/collection-requests`                | COLLECTOR | List own requests            |
| **GET**    | `/collector/collection-requests/:id`            | COLLECTOR | Get specific request         |
| **PATCH**  | `/collector/collection-requests/:id/cancel`     | COLLECTOR | Cancel request               |
| **GET**    | `/collector/leaderboard`                        | COLLECTOR | Get collector leaderboard     |
| **GET**    | `/rider/collection-requests`                    | RIDER     | List pending requests        |
| **GET**    | `/rider/collection-requests/my`                 | RIDER     | List assigned requests       |
| **GET**    | `/rider/collection-requests/:id`                | RIDER     | Get specific request         |
| **PATCH**  | `/rider/collection-requests/:id/accept`         | RIDER     | Accept request               |
| **POST**   | `/rider/collection-requests/:id/verify-qr-token`| RIDER     | Verify collector QR token    |
| **POST**   | `/rider/collection-requests/:id/complete`       | RIDER     | Complete collection          |
| **GET**    | `/rider/vehicles`                               | RIDER     | List active vehicles         |

---

## Local Development

### Starting the Backend

**Prerequisites**:

- Node.js 18+ installed
- PostgreSQL running locally (or configured via DATABASE_URL)
- `.env` file configured with DATABASE_URL and JWT_SECRET

**Commands**:

```bash
# Install dependencies
npm install

# Run database migrations (if needed)
npx prisma migrate dev

# Start development server with hot reload
npm run start:dev

# Build for production
npm run build

# Start production build
npm run start:prod
```

**Server runs on**: http://localhost:3000

### Testing Endpoints

**Using cURL**:

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"COLLECTOR001","password":"SecurePass123"}'

# Get current user
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <token>"
```

**Using Postman**:

1. Create POST request to `http://localhost:3000/auth/login`
2. Set Body to raw JSON: `{"loginId":"...","password":"..."}`
3. Copy `accessToken` from response
4. For subsequent requests, add header: `Authorization: Bearer <token>`

### Database Access

**Connect to PostgreSQL**:

```bash
psql -U postgres -d neptune
```

**View Prisma Data Studio** (interactive database viewer):

```bash
npx prisma studio
```

Opens at http://localhost:5555

---

## Backend Handover Status

### ✅ Features Complete

- [x] User authentication (JWT-based)
- [x] Role-based authorization (ADMIN, COLLECTOR, RIDER)
- [x] Admin management (Collectors, Riders, Vehicles, Assignments)
- [x] Collector API (assignments, collection requests)
- [x] Rider API (pending requests, acceptance, completion)
- [x] Collection workflow (PENDING → ACCEPTED → COMPLETED)
- [x] Collection record creation (transactional)
- [x] Request cancellation (PENDING → CANCELLED)
- [x] QR token verification (rider verifies collector identity)
- [x] QR verification gate on collection completion
- [x] Rider vehicle selection (GET /rider/vehicles)
- [x] Collector QR token exposure via /auth/me
- [x] Collector leaderboard (personal stats)
- [x] Admin leaderboard (all collectors ranking)
- [x] Validation and error handling
- [x] Database schema with relationships
- [x] Password hashing (Argon2)
- [x] JWT token management

### ✅ Testing Verification

- [x] All endpoints routing correctly
- [x] Authentication guard working (401 for missing JWT)
- [x] Authorization guard working (403 for wrong role)
- [x] Ownership validation working (404 for non-owned resources)
- [x] State transitions enforced (409 for invalid transitions)
- [x] Validation rules applied (400 for invalid data)
- [x] Build compiles without errors
- [x] No passwordHash exposed in responses

### ⚠️ Production Deployment Status

- [x] Production database provisioned (Supabase)
- [x] Production JWT secret configured
- [x] SSL/HTTPS endpoint available
- [x] Production API URL documented
- [ ] Deployment pipeline configured (pending CI/CD)
- [ ] Load balancing configured (pending)
- [ ] Monitoring/logging configured (pending)
- [ ] Backup strategy implemented (pending)

### ⚠️ Not Yet Implemented

- [x] Test coverage documentation
- [x] API rate limiting
- [x] Audit logging
- [x] Advanced analytics
- [x] Multi-language support
- [x] Push notifications
- [x] Offline sync
- [ ] Production deployment

### 📱 Mobile Integration Readiness

✅ **READY FOR FLUTTER INTEGRATION**

All API endpoints are implemented, tested, and documented. Flutter developers can begin:

1. **Collector Mobile App**: Login, view assignments, create requests, monitor status, cancel requests
2. **Rider Mobile App**: Login, browse requests, accept requests, verify collector QR, select vehicles, complete collections

### Next Steps

1. **Flutter Development**: Begin mobile app development using this API specification
2. **Production Deployment**: Contact backend team for production URL and credentials
3. **Integration Testing**: Test mobile apps against live backend
4. **UAT**: User acceptance testing with actual Collectors and Riders
5. **Production Launch**: Deploy mobile apps to app stores

---

## Appendix: Data Type Reference

### Date/DateTime Formats

- **Dates** (Assignment): `YYYY-MM-DD` (e.g., "2026-08-13")
- **DateTimes** (Responses): ISO 8601 (e.g., "2026-08-13T11:00:00Z")
- **Token Validity**: 15 minutes from issuance

### UUID Format

All IDs are UUIDs (v4 format): `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

Example: `550e8400-e29b-41d4-a716-446655440000`

### Decimal Precision

- **Latitude/Longitude**: 7 decimal places (e.g., 6.9271234)
- **Weight**: 2 decimal places (e.g., 45.50 kg)

### Enum Values

**UserRole**: ADMIN, COLLECTOR, RIDER

**UserStatus**: ACTIVE, INACTIVE

**VehicleStatus**: ACTIVE, INACTIVE

**CollectionRequestStatus**: PENDING, ACCEPTED, COMPLETED, CANCELLED

---

**Document Version**: 2.1  
**Last Updated**: 2026-08-17  
**Backend Version**: 0.0.2  
**Status**: Production Ready for Flutter Integration

---

**For questions or clarifications, contact the backend development team.**
