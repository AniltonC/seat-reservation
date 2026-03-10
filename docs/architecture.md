# Seat Reservation System
## System Architecture Document

> Version 1.0 • March 2026
---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture)
3. [Domains and Data Models](#3-domains-and-data-models)
4. [Critical Business Rules](#4-critical-business-rules)
5. [API Endpoints](#5-api-endpoints)
6. [Tech Stack](#6-tech-stack)
7. [Worker — Async Jobs](#7-worker--async-jobs)
8. [Testing Strategy — TDD](#8-testing-strategy--tdd)
9. [CI/CD Pipeline](#9-cicd-pipeline)

---

## 1. System Overview

The Seat Reservation System is a robust backend platform that allows users to browse available sessions, select seats in real time, and confirm bookings with uniqueness guarantees — no seat can ever be sold twice, even under high concurrency.

The system solves one of the most classic software engineering problems: double booking. Two users can click the same seat at the same millisecond. The solution involves database-level locks, temporary reservations with automatic expiration, and an asynchronous job queue.

### 1.1 Main Flow

The user starts by browsing available sessions and viewing the seat map for a chosen session. After selecting a seat, a temporary booking is created with a 10-minute countdown for payment confirmation. Once the user confirms payment, the booking becomes permanent. If the payment window expires without confirmation, the worker automatically releases the seat and makes it available again.

### 1.2 Scope Decisions

| Included in System | Out of Scope (v1) |
|---|---|
| Seat booking and cancellation | Real payment gateway |
| Automatic booking expiration | OAuth / SSO authentication |
| Real-time availability query | Native mobile app |
| Documented REST API | Multi-language support |
| Tests with 1:1 coverage | Reports and analytics |

---

## 2. System Architecture

### 2.1 Macro View — Layers

| Layer | Component | Responsibility |
|---|---|---|
| Entry | API (Fastify) | Receives HTTP requests, validates, routes |
| Business | Services | Domain rules, orchestration |
| Persistence | PostgreSQL + Prisma | Relational data with ACID transactions |
| Cache / Lock | Redis | Temporary seat lock, session cache |
| Async | Worker + BullMQ | Expiration jobs, notifications |
| Infra | Docker + GitHub Actions | Environment, CI/CD, deploy |

### 2.2 Monorepo Structure

```
seat-reservation/
├── apps/
│   ├── api/              # Fastify + TypeScript — REST API
│   └── worker/           # BullMQ — Async jobs
├── packages/
│   └── shared/           # Shared TypeScript types
├── infra/
│   ├── docker-compose.yml
│   └── nginx.conf
├── .github/
│   └── workflows/ci.yml  # CI/CD pipeline
└── README.md
```

### 2.3 API Internal Architecture

```
apps/api/src/
├── routes/              # HTTP endpoints (thin layer)
├── services/            # Business rules
├── repositories/        # Database access (Prisma)
├── schemas/             # Zod validation
├── middleware/          # Auth, error handler
└── lib/                 # Redis client, logger
```

---

## 3. Domains and Data Models

### 3.1 Core Entities

#### Room

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique identifier |
| name | String | Room name (e.g. Theater 3) |
| rows | Int | Number of rows |
| columns | Int | Seats per row |
| totalSeats | Int | Total capacity (computed) |
| createdAt | DateTime | Creation timestamp |

#### Session

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique identifier |
| roomId | UUID | FK → Room |
| title | String | Event name (movie, show, etc.) |
| startsAt | DateTime | Start date and time |
| price | Decimal | Ticket price |
| status | Enum | SCHEDULED, ONGOING, FINISHED or CANCELLED |

#### Seat

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique identifier |
| roomId | UUID | FK → Room |
| row | String | Row label (A, B, C...) |
| column | Int | Seat number within the row |
| label | String | Display label (e.g. A7) |
| type | Enum | STANDARD, VIP or ACCESSIBLE |

#### Booking

| Field | Type | Description |
|---|---|---|
| id | UUID | Unique identifier |
| sessionId | UUID | FK → Session |
| seatId | UUID | FK → Seat |
| userId | UUID | FK → User |
| status | Enum | PENDING, CONFIRMED, CANCELLED or EXPIRED |
| expiresAt | DateTime | Confirmation deadline (PENDING + 10 min) |
| confirmedAt | DateTime | Confirmation timestamp (nullable) |
| createdAt | DateTime | Creation timestamp |

---

## 4. Critical Business Rules

### 4.1 Booking Uniqueness — The Double Booking Problem

This is the most important rule in the system. Any attempt to book an already-reserved seat must fail safely, even with multiple concurrent requests.

The adopted solution uses a SELECT FOR UPDATE command inside a PostgreSQL transaction. The database queries the bookings table filtering by the session and seat identifiers, looking for any record with PENDING or CONFIRMED status, and immediately locks that row. If a matching row is found, the transaction rolls back and the seat is considered unavailable. If no row is found, the booking is created and the transaction commits. This lock prevents any concurrent request from reading or writing to the same row until the transaction completes.

### 4.2 Booking Lifecycle

| Transition | Trigger | Effect |
|---|---|---|
| → PENDING | User selects a seat | Seat locked, 10-min timer starts |
| PENDING → CONFIRMED | User confirms payment | Permanent booking, timer cancelled |
| PENDING → EXPIRED | Worker detects expiration | Seat automatically released |
| CONFIRMED → CANCELLED | User cancels | Seat released, refund processed |
| PENDING → CANCELLED | User gives up | Seat immediately released |

### 4.3 Validation Rules

- Cannot book a seat in a FINISHED or CANCELLED session
- Cannot book two seats in the same session with the same user (v1)
- The expiresAt field is always set to createdAt plus 10 minutes for PENDING bookings
- Only the booking owner can cancel it
- EXPIRED bookings cannot be reactivated — the user must create a new one

---

## 5. API Endpoints

### 5.1 Sessions

| Method | Route | Description | Auth |
|---|---|---|---|
| GET | /sessions | List available sessions (with filters) | No |
| GET | /sessions/:id | Session details | No |
| GET | /sessions/:id/seats | Seat map with availability | No |

### 5.2 Bookings

| Method | Route | Description | Auth |
|---|---|---|---|
| POST | /bookings | Create temporary booking (PENDING) | Yes |
| PATCH | /bookings/:id/confirm | Confirm booking (CONFIRMED) | Yes |
| DELETE | /bookings/:id | Cancel booking | Yes |
| GET | /bookings/:id | Booking details | Yes |
| GET | /bookings/me | Authenticated user's bookings | Yes |

### 5.3 Users

| Method | Route | Description | Auth |
|---|---|---|---|
| POST | /auth/register | Register new user | No |
| POST | /auth/login | Login, returns JWT | No |
| GET | /users/me | Authenticated user profile | Yes |

---

## 6. Tech Stack

| Category | Technology | Version | Rationale |
|---|---|---|---|
| Runtime | Node.js | 22 LTS | Stable, widely supported |
| Language | TypeScript | 5.x | Static typing, better DX |
| HTTP Framework | Fastify | 5.x | Superior performance, native TS support |
| Validation | Zod | 3.x | Schema + type inference in one place |
| ORM | Prisma | 6.x | Type-safe, migrations, great DX |
| Database | PostgreSQL | 16 | ACID, SELECT FOR UPDATE, reliable |
| Cache / Lock | Redis | 7.x | Temporary seat lock, availability cache |
| Job Queue | BullMQ | 5.x | Node ecosystem standard for queues |
| Testing | Vitest | 2.x | Faster than Jest, same API |
| Containerization | Docker + Compose | Latest | Identical local/production environment |
| CI/CD | GitHub Actions | - | Free, integrated with the repository |
| Deploy | Railway / Fly.io | - | Simple PaaS, no VPS management |

---

## 7. Worker — Async Jobs

The Worker is a separate Node.js process that consumes Redis queues via BullMQ. It handles tasks that must not block the API and require automatic retry on failure.

### 7.1 Planned Jobs

| Job | Trigger | Action | Retry |
|---|---|---|---|
| expireBooking | 10 min after PENDING created | Changes status to EXPIRED, releases seat | 3x with backoff |
| sendConfirmation | Booking CONFIRMED | Sends confirmation email to user | 5x with backoff |
| sendCancellation | Booking CANCELLED | Sends cancellation email | 3x with backoff |

---

## 8. Testing Strategy — TDD

Following the Anti Vibe Coding Challenge: every function has a corresponding test written before the implementation. The AI only writes code to make an existing test pass.

| Level | Tool | What it tests | Coverage goal |
|---|---|---|---|
| Unit | Vitest | Services, validations, isolated business rules | 100% |
| Integration | Vitest + Testcontainers | Repositories with real DB in Docker | 80%+ |
| E2E | Vitest + Supertest | Full endpoints (request → response) | Critical flows |
| Concurrency | Vitest | Simultaneous double booking (race condition) | Mandatory |

### 8.1 Critical Test — Race Condition

The most important test in the system validates that only one booking succeeds when two users attempt to reserve the same seat simultaneously. The test fires two booking requests at the exact same time using a parallel execution strategy. After both requests settle, the test asserts that exactly one resulted in a PENDING booking and the other produced a failure. Without the SELECT FOR UPDATE lock in place, both requests could pass the availability check before either writes to the database, causing the double booking the system is designed to prevent.

---

## 9. CI/CD Pipeline

No code goes to the main branch without passing the full pipeline. The pipeline automatically blocks the merge if any step fails.

### 9.1 Pipeline Steps

| Step | Tool | Success criteria |
|---|---|---|
| 1. Lint | ESLint + Prettier | Zero warnings or errors |
| 2. Type Check | tsc --noEmit | TypeScript compilation without errors |
| 3. Unit Tests | Vitest | 100% of tests passing |
| 4. Integration Tests | Vitest + Docker | All tests passing |
| 5. Security Audit | npm audit | Zero critical or high vulnerabilities |
| 6. Build | tsc | Build without errors |
| 7. Deploy | Railway / Fly.io | Successful deploy to staging |

---

*Seat Reservation System • Architecture v1.0*