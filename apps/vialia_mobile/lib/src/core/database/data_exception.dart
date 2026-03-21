class AppDataException implements Exception {
  const AppDataException(this.message);

  final String message;

  @override
  String toString() => message;
}
