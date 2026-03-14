# Seat Reservation System
## Test Plan Document

> Version 1.0 • March 2026*

**Test Levels:** `Unit` `Integration` `E2E` `Concurrency`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Rooms](#2-rooms)
3. [Sessions](#3-sessions)
4. [Bookings](#4-bookings)
5. [Booking Expiration — Worker](#5-booking-expiration--worker)
6. [Concurrency — Race Conditions](#6-concurrency--race-conditions)
7. [End-to-End — Critical Flows](#7-end-to-end--critical-flows)

---

## 1. Authentication

---

### TC-AUTH-001 — Register with valid data
`Unit`

Validates that a new user can be registered successfully when all required fields are provided with valid values.

**Initial Setup:** *Clean database with no existing users.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Send a registration request with a valid name, unique email, and a password that meets complexity requirements. | Service returns a new user object containing id, name, email, and createdAt. Password is not returned. |
| 2 | Verify the password stored in the database is hashed and not stored in plain text. | The stored password field contains a bcrypt hash, not the original password string. |
| 3 | Attempt to register again using the same email address. | Service throws a conflict error indicating the email is already in use. |

---

### TC-AUTH-002 — Register with invalid data
`Unit`

Validates that registration is rejected when required fields are missing or contain invalid values.

**Initial Setup:** *Clean database with no existing users.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Send a registration request with an empty name field. | Validation throws an error indicating name is required. |
| 2 | Send a registration request with a malformed email address (e.g. missing @ symbol). | Validation throws an error indicating the email format is invalid. |
| 3 | Send a registration request with a password shorter than the minimum required length. | Validation throws an error indicating the password does not meet complexity requirements. |
| 4 | Send a registration request with a password without an uppercase letter. | Validation throws an error indicating the password does not meet complexity requirements. |
| 5 | Send a registration request with a password without a numeric character. | Validation throws an error indicating the password does not meet complexity requirements. |
| 6 | Send a registration request with all fields missing. | Validation throws errors for all required fields simultaneously. |

---

### TC-AUTH-003 — Login with valid credentials
`Unit`

Validates that a registered user can log in and receive a valid JWT token.

**Initial Setup:** *Database contains one registered user with known credentials.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Send a login request with the correct email and password. | Service returns a JWT token and the user's basic profile data. |
| 2 | Decode the returned JWT token and inspect its payload. | Token payload contains the user id, email, and a valid expiration timestamp. |
| 3 | Use the returned token to access a protected endpoint. | The protected endpoint responds with status 200 and the expected data. |

---

### TC-AUTH-004 — Login with invalid credentials
`Unit`

Validates that login is rejected when credentials are incorrect or the user does not exist.

**Initial Setup:** *Database contains one registered user with known credentials.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Send a login request with the correct email but a wrong password. | Service throws an unauthorized error. No token is returned. |
| 2 | Send a login request with an email that does not exist in the database. | Service throws an unauthorized error. No token is returned. |
| 3 | Send a login request with both fields empty. | Validation throws an error indicating both fields are required. |

---

### TC-AUTH-005 — Access protected route without token
`E2E`

Validates that protected endpoints reject requests that do not include a valid JWT token.

**Initial Setup:** *API server is running. At least one protected route exists.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Send a GET request to /users/me without any Authorization header. | API responds with status 401 Unauthorized. |
| 2 | Send a GET request to /users/me with a malformed token in the Authorization header. | API responds with status 401 Unauthorized. |
| 3 | Send a GET request to /users/me with an expired JWT token. | API responds with status 401 Unauthorized. |
| 4 | Send a GET request to /users/me with a valid JWT token. | API responds with status 200 and the authenticated user's profile data. |

---

## 2. Rooms

---

### TC-ROOM-001 — Create a room with valid data
`Integration`

Validates that a room is correctly persisted in the database when all required fields are provided.

**Initial Setup:** *Empty database. Prisma client connected to the test container.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the room repository create method with a valid name, row count, and column count. | A room record is returned with a generated UUID, the provided fields, and a createdAt timestamp. |
| 2 | Query the database directly to confirm the record was persisted. | The room record exists in the rooms table with all fields matching the input. |
| 3 | Verify the totalSeats computed value equals rows multiplied by columns. | The totalSeats field reflects the correct product of the provided row and column values. |

---

### TC-ROOM-002 — Reject room with invalid dimensions
`Unit`

Validates that a room cannot be created with zero or negative values for rows or columns.

**Initial Setup:** *No database required. Service is tested in isolation.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Attempt to create a room with rows set to zero. | Service throws a validation error indicating rows must be greater than zero. |
| 2 | Attempt to create a room with columns set to a negative number. | Service throws a validation error indicating columns must be a positive integer. |
| 3 | Attempt to create a room with an empty name. | Service throws a validation error indicating name is required. |

---

## 3. Sessions

---

### TC-SESS-001 — Create a session linked to a room
`Integration`

Validates that a session is correctly persisted and properly linked to an existing room.

**Initial Setup:** *Database contains one room. Prisma client connected to the test container.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the session repository create method with a valid title, roomId, future startsAt datetime, and price. | A session record is returned with a generated UUID, status SCHEDULED, and all provided fields. |
| 2 | Query the sessions table and join with the rooms table. | The session record references the correct room through the roomId foreign key. |
| 3 | Verify the default status assigned to a new session. | The status field is set to SCHEDULED automatically upon creation. |

---

### TC-SESS-002 — Reject session with non-existent room
`Unit`

Validates that a session cannot be created if the referenced room does not exist.

**Initial Setup:** *No database required. Service is tested with a mocked repository.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Attempt to create a session with a roomId that does not correspond to any existing room. | Service throws a not-found error indicating the referenced room does not exist. |

---

### TC-SESS-003 — Reject session with past start date
`Unit`

Validates that a session cannot be scheduled with a start date in the past.

**Initial Setup:** *No database required. Service is tested in isolation.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Attempt to create a session with a startsAt datetime set to yesterday. | Service throws a validation error indicating the start date must be in the future. |
| 2 | Attempt to create a session with a startsAt datetime set to the current moment. | Service throws a validation error indicating the start date must be strictly in the future. |
| 3 | Attempt to create a session with a startsAt datetime set to tomorrow. | Session is created successfully. |

---

### TC-SESS-004 — List available sessions with filters
`Integration`

Validates that the session listing returns only scheduled sessions and correctly applies optional filters.

**Initial Setup:** *Database contains sessions with statuses SCHEDULED, ONGOING, FINISHED, and CANCELLED.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the session repository list method with no filters. | Only sessions with status SCHEDULED or ONGOING are returned. FINISHED and CANCELLED sessions are excluded. |
| 2 | Call the list method filtering by a specific date. | Only sessions scheduled for that date are returned. |
| 3 | Call the list method filtering by title keyword. | Only sessions whose title contains the keyword are returned. |

---

### TC-SESS-005 — Retrieve seat map for a session
`Integration`

Validates that the seat map for a session returns all seats with their current availability status.

**Initial Setup:** *Database contains one room with 5 rows and 5 columns (25 seats total). One session exists for that room. Two seats have CONFIRMED bookings.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the session service method to get the seat map for the session. | All 25 seats are returned. Each seat contains its label, type, row, column, and availability status. |
| 2 | Verify the status of the two seats with existing confirmed bookings. | Those two seats are marked as OCCUPIED. The remaining 23 seats are marked as AVAILABLE. |
| 3 | Create a PENDING booking for one additional seat and re-fetch the seat map. | The newly pending seat is marked as RESERVED. The other 22 seats remain AVAILABLE. |

---

## 4. Bookings

---

### TC-BOOK-001 — Create a booking for an available seat
`Unit`

Validates the happy path: a user successfully creates a PENDING booking for a seat that is not yet reserved.

**Initial Setup:** *Mocked repository returns no existing bookings for the target session and seat.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service create method with a valid sessionId, seatId, and userId. | Service returns a booking object with status PENDING and an expiresAt value set to exactly 10 minutes after createdAt. |
| 2 | Verify that the repository create method was called exactly once with the correct parameters. | The mock confirms the repository received sessionId, seatId, userId, status PENDING, and the computed expiresAt. |

---

### TC-BOOK-002 — Reject booking for an already reserved seat
`Unit`

Validates that a booking cannot be created if the seat is already PENDING or CONFIRMED for the same session.

**Initial Setup:** *Mocked repository returns an existing PENDING booking for the target session and seat.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service create method with the same sessionId and seatId that already has a PENDING booking. | Service throws a conflict error indicating the seat is not available. |
| 2 | Replace the existing booking status with CONFIRMED and attempt again. | Service throws the same conflict error. |
| 3 | Replace the existing booking status with EXPIRED and attempt again. | Service creates a new PENDING booking successfully, since EXPIRED does not block availability. |
| 4 | Replace the existing booking status with CANCELLED and attempt again. | Service creates a new PENDING booking successfully, since CANCELLED does not block availability. |

---

### TC-BOOK-003 — Reject booking for a cancelled session
`Unit`

Validates that a booking cannot be created for a session that is no longer active.

**Initial Setup:** *Mocked repository returns a session with status CANCELLED.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service create method targeting a CANCELLED session. | Service throws a conflict error indicating the session is not available for booking. |
| 2 | Repeat the test with a session in FINISHED status. | Service throws the same conflict error. |
| 3 | Repeat the test with a session in SCHEDULED status. | Service proceeds and creates the booking normally. |

---

### TC-BOOK-004 — Reject duplicate booking by the same user in the same session
`Unit`

Validates that a user cannot hold more than one active booking per session.

**Initial Setup:** *Mocked repository returns an existing PENDING booking for the same userId and sessionId.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service create method with a userId and sessionId that already has an active booking for that user. | Service throws a conflict error indicating the user already has a booking for this session. |
| 2 | Change the existing booking status to EXPIRED and attempt again. | Service creates a new booking successfully. |

---

### TC-BOOK-005 — Confirm a pending booking
`Integration`

Validates that a PENDING booking transitions correctly to CONFIRMED status.

**Initial Setup:** *Database contains one PENDING booking that has not yet expired.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service confirm method with the booking id. | Booking status changes to CONFIRMED. The confirmedAt field is populated with the current timestamp. |
| 2 | Verify the expiresAt field after confirmation. | The expiresAt field remains set but is no longer relevant since the booking is now CONFIRMED. |
| 3 | Attempt to confirm the same booking a second time. | Service throws an error indicating the booking is already confirmed. |

---

### TC-BOOK-006 — Reject confirmation of an expired booking
`Unit`

Validates that a booking that has already expired cannot be confirmed.

**Initial Setup:** *Mocked repository returns a booking with status EXPIRED.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service confirm method with the id of an EXPIRED booking. | Service throws an error indicating the booking has expired and cannot be confirmed. |

---

### TC-BOOK-007 — Cancel a pending booking
`Unit`

Validates that the owner of a PENDING booking can cancel it, releasing the seat.

**Initial Setup:** *Mocked repository returns a PENDING booking owned by user-1.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service cancel method with the booking id and the owner's userId. | Booking status changes to CANCELLED. Seat is released immediately. |
| 2 | Call the cancel method with a userId that does not own the booking. | Service throws a forbidden error indicating only the booking owner can cancel it. |

---

### TC-BOOK-008 — Cancel a confirmed booking
`Unit`

Validates that a CONFIRMED booking can be cancelled by its owner.

**Initial Setup:** *Mocked repository returns a CONFIRMED booking owned by user-1.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service cancel method with the booking id and the owner's userId. | Booking status changes to CANCELLED. Seat is released. |
| 2 | Attempt to cancel a booking that is already CANCELLED. | Service throws an error indicating the booking is already cancelled. |

---

### TC-BOOK-009 — Reject cancellation of an expired booking
`Unit`

Validates that an already-expired booking cannot be cancelled.

**Initial Setup:** *Mocked repository returns a booking with status EXPIRED.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking service cancel method with the id of an EXPIRED booking. | Service throws an error indicating expired bookings cannot be cancelled. |

---

### TC-BOOK-010 — List bookings for the authenticated user
`Integration`

Validates that a user can retrieve all of their own bookings and cannot access bookings from other users.

**Initial Setup:** *Database contains 3 bookings for user-1 and 2 bookings for user-2.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Call the booking repository list method filtered by user-1's id. | Exactly 3 bookings are returned, all belonging to user-1. |
| 2 | Call the booking repository list method filtered by user-2's id. | Exactly 2 bookings are returned, all belonging to user-2. |
| 3 | Verify that the results include bookings in multiple statuses. | Bookings with PENDING, CONFIRMED, and other statuses are all included in the list. |

---

## 5. Booking Expiration — Worker

---

### TC-EXP-001 — Expire a booking after the deadline
`Integration`

Validates that the expiration job correctly transitions a PENDING booking to EXPIRED when the 10-minute window has passed.

**Initial Setup:** *Database contains a PENDING booking with expiresAt set to 1 minute in the past.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Trigger the expireBooking job manually for the expired booking id. | Booking status changes from PENDING to EXPIRED. |
| 2 | Verify the seat is available again by querying the seat map. | The seat previously held by the expired booking is now shown as AVAILABLE. |
| 3 | Confirm the job does not alter bookings that have not yet expired. | A PENDING booking with expiresAt set 5 minutes in the future remains PENDING and unchanged. |

---

### TC-EXP-002 — Do not expire a confirmed booking
`Unit`

Validates that the expiration job does not affect bookings that have already been confirmed.

**Initial Setup:** *Mocked repository returns a CONFIRMED booking with a past expiresAt timestamp.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Trigger the expireBooking job for the id of a CONFIRMED booking. | Job exits without changing the booking status. Booking remains CONFIRMED. |

---

### TC-EXP-003 — Retry job on failure
`Integration`

Validates that the BullMQ worker retries the expiration job automatically when it fails due to a transient error.

**Initial Setup:** *Worker is configured with 3 retries and exponential backoff. Database connection is temporarily unavailable.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Enqueue an expireBooking job while the database connection is unavailable. | Job fails and is automatically re-enqueued for the first retry. |
| 2 | Restore the database connection before the third retry. | Job succeeds on the next available attempt. Booking is marked as EXPIRED. |
| 3 | Simulate failure across all 3 retry attempts. | Job is moved to the failed queue after exhausting all retries. An error is logged. |

---

## 6. Concurrency — Race Conditions

---

### TC-CONC-001 — Prevent double booking under simultaneous requests
`Concurrency`

Validates the core safety guarantee of the system: when two users attempt to book the same seat at the same time, only one succeeds.

**Initial Setup:** *Database contains one session and one available seat. Two distinct users exist.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Fire two booking creation requests for the same session and seat simultaneously using Promise.all. | Exactly one request succeeds and returns a PENDING booking. The other request returns a conflict error. |
| 2 | Query the bookings table for that session and seat. | Exactly one PENDING booking record exists. No duplicate records are found. |
| 3 | Verify the identity of the successful user. | The booking belongs to one of the two users. The other user received the error response. |

---

### TC-CONC-002 — Allow concurrent bookings for different seats
`Concurrency`

Validates that the SELECT FOR UPDATE lock does not block concurrent requests that target different seats in the same session.

**Initial Setup:** *Database contains one session and two available seats. Two distinct users exist.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Fire two simultaneous booking requests, each targeting a different seat in the same session. | Both requests succeed. Each user receives a PENDING booking for their respective seat. |
| 2 | Query the bookings table for the session. | Two distinct PENDING booking records exist, one for each seat. |

---

### TC-CONC-003 — Prevent booking a seat that is being confirmed simultaneously
`Concurrency`

Validates that a new booking attempt on a seat that is mid-confirmation is properly blocked.

**Initial Setup:** *Database contains one PENDING booking for seat A7. A second user attempts to book the same seat while confirmation is in progress.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | Simultaneously trigger a booking confirmation for the existing PENDING booking and a new booking creation for the same seat. | The confirmation succeeds. The new booking creation fails with a conflict error. |
| 2 | Query the bookings table for that seat and session. | Only one booking record exists with status CONFIRMED. |

---

## 7. End-to-End — Critical Flows

---

### TC-E2E-001 — Complete booking flow
`E2E`

Validates the full happy path from user registration to confirmed booking through the HTTP API.

**Initial Setup:** *API and Worker are running. Database and Redis are clean.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | POST /auth/register with valid user data. | Response status 201. User is created. |
| 2 | POST /auth/login with the registered credentials. | Response status 200. JWT token is returned. |
| 3 | GET /sessions to list available sessions. | Response status 200. At least one session is returned. |
| 4 | GET /sessions/:id/seats to view the seat map. | Response status 200. All seats are shown as AVAILABLE. |
| 5 | POST /bookings with a valid sessionId and seatId using the JWT token. | Response status 201. Booking is created with status PENDING and expiresAt set to 10 minutes from now. |
| 6 | GET /sessions/:id/seats again for the same session. | The booked seat now appears as RESERVED in the seat map. |
| 7 | PATCH /bookings/:id/confirm to confirm the booking. | Response status 200. Booking status is now CONFIRMED. |
| 8 | GET /sessions/:id/seats one more time. | The confirmed seat now appears as OCCUPIED. |

---

### TC-E2E-002 — Booking expiration flow
`E2E`

Validates that a seat becomes available again after a PENDING booking expires.

**Initial Setup:** *API and Worker are running. One session and one available seat exist.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | POST /bookings to create a PENDING booking for a seat. | Response status 201. Booking is PENDING. |
| 2 | GET /sessions/:id/seats immediately after booking. | The seat is shown as RESERVED. |
| 3 | Wait for the expiration job to process (simulate by manually triggering with a past expiresAt). | Worker processes the expireBooking job successfully. |
| 4 | GET /sessions/:id/seats after expiration. | The seat is now shown as AVAILABLE again. |
| 5 | Attempt PATCH /bookings/:id/confirm on the expired booking. | Response status 422. Booking is EXPIRED and cannot be confirmed. |

---

### TC-E2E-003 — Cancellation flow
`E2E`

Validates that a user can cancel a booking and that the seat becomes available for other users.

**Initial Setup:** *API is running. One authenticated user has an active PENDING booking.*

| Step | Description | Expected Result |
|---|---|---|
| 1 | DELETE /bookings/:id with the owner's JWT token. | Response status 200. Booking status is CANCELLED. |
| 2 | GET /sessions/:id/seats after cancellation. | The previously reserved seat is now AVAILABLE. |
| 3 | Attempt DELETE /bookings/:id again on the already-cancelled booking. | Response status 422. Cannot cancel an already cancelled booking. |
| 4 | Attempt DELETE /bookings/:id with a different user's JWT token on an active booking. | Response status 403. Only the booking owner can cancel. |

---

*Seat Reservation System • Test Plan v1.0*