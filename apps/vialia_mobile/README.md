# Vialia Mobile

Standalone Flutter client for the Vialia migration.

## Stack

- Flutter 3.38
- Riverpod for app state
- GoRouter for navigation
- `mongo_dart` for direct MongoDB Atlas access
- `bcrypt` for client-side password verification
- Flutter Secure Storage for persisted session identity

## Implemented mobile slices

- Auth: login, register, persisted session restore
- Dashboard: readiness summary, weak topics, leaderboard, recent trend
- Practice: official, custom, mistakes, weak-topic, bookmark, and SRS launches
- Exam flow: fetch session, answer questions, submit, and review summary
- Flashcards: deck list, due-card practice, review feedback
- Bookmarks: list, toggle, launch bookmark practice
- Profile: language/theme sync, logout

## Run locally

1. Install dependencies:

```bash
cd apps/vialia_mobile
flutter pub get
```

2. Run on a simulator, emulator, or physical device with your Atlas URI:

```bash
flutter run --dart-define=MONGODB_URI="mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority"
```

## Verification

```bash
flutter analyze
flutter test
```

## Notes

- The app connects directly from Flutter to MongoDB Atlas. No separate app backend is required.
- This intentionally accepts the security tradeoff that Atlas credentials and data-access logic live in the client binary.
- Use a least-privileged Atlas database user for the mobile app and make sure Atlas network access allows device connections.
- The mobile app targets learner flows first. Admin and web-only back-office tools are not exposed in the current handset UI.
