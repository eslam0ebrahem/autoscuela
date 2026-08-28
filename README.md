# Autoscuela — Driving School Booking App

**JavaScript · Node.js · Express · MongoDB**

A full-stack web application for managing driving school bookings, student records, and instructor schedules.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Language | JavaScript |
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB |
| Frontend | React |
| Auth | JWT |
| Testing | Jest |

---

## Features

- **Student Management** — Register and manage student profiles
- **Lesson Scheduling** — Book and manage driving lesson slots
- **Instructor Dashboard** — Instructors can view and manage their schedule
- **JWT Authentication** — Secure role-based access (student / instructor / admin)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start the server
npm run dev

# Run tests
npm test
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new student |
| POST | `/auth/login` | Login |
| GET | `/lessons` | List available lessons |
| POST | `/lessons` | Book a lesson |
| GET | `/students` | List students (instructor/admin) |
| PUT | `/students/:id` | Update student info |

---

## Project Structure

```
app/            # Main application code
components/    # React components
lib/            # Shared utilities
middleware/     # Auth & validation middleware
models/         # MongoDB schemas
routes/         # Express route definitions
__tests__/      # Test files
```

---

## License

MIT
