# Flutter Migration Guide

## What was created

This repository now contains a Flutter-first migration baseline:

- `apps/vialia_mobile`: the standalone Flutter client for Android and iOS

The mobile app now talks directly to MongoDB Atlas from Flutter using `mongo_dart`.

## Architecture decisions

### Mobile architecture

- Riverpod for app state
- GoRouter for scalable navigation
- Feature-first structure under `lib/src/features`
- Clear split between presentation, data, and domain models
- Secure persisted session identity via `flutter_secure_storage`
- Shared client-side data utilities for Mongo mapping, study logic, validation, and error handling
- Direct Atlas collection access from repositories

## Atlas access model

- The app expects `MONGODB_URI` via `--dart-define`
- Authentication, validation, and study flows run on-device
- This is acceptable only because the project explicitly accepts the risk of shipping database credentials in the client
- Even with that tradeoff accepted, the Atlas user should still be least-privileged and scoped only to the collections the app needs

## Feature mapping

### Ported now

- Authentication
- Dashboard summary
- Readiness and deterministic coach feedback
- Practice exam generation and submission
- Flashcards and spaced repetition
- Bookmarks
- Mistakes review
- Stats and leaderboard
- Theme and language preferences

### Intentionally redesigned

- AI/Groq flows are replaced by deterministic analytics to satisfy the "no extra third-party APIs" constraint.
- Stripe billing is not part of this mobile migration baseline.
- Admin panels are not surfaced in the mobile UI.
- The previous backend layer was removed in favor of direct Atlas access from Flutter.

## Important issues found in the current Next.js app

These are worth keeping in mind even if the legacy app remains live during the migration:

1. `app/api/exams/[sessionId]/route.js`
   The session fetch returns full question documents, including `correct_option_idx`, before the exam is finished.

2. `app/api/exams/[sessionId]/answer/route.js`
   AI explanation payload subtracts `1` from `correct_option_idx` and `selected_option_idx` even though the stored schema is already zero-based.

3. `app/api/bookmarks/route.js`
   Stale bookmark cleanup pulls from `bookmarks`, but the actual user field is `bookmarkedQuestions`.

4. `app/api/exams/generate/route.js`
   `estimatePassProbability` treats `skillProfile.overallLevel` like a number even though it is stored as a string enum.

5. `app/api/mistakes/route.js`
   Difficulty filtering happens after pagination, so the returned `total` and result pages can become inconsistent.

6. `app/api/exams/[sessionId]/submit/route.js`
   Topic breakdown relies on answer topic data, but session answers are written without a topic field in the answer route.

## Recommended next steps

1. Validate the new direct-Atlas Flutter repositories against the real production Atlas collections and indexes.
2. Decide whether you want an on-device cache layer such as Isar for offline reads and lower startup latency.
3. Add integration tests around auth, exam submission, and bookmark/mistake flows.
4. Add app icons, launch screens, and production signing/configuration for Android and iOS.
