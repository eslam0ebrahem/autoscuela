class AppConfig {
  const AppConfig._();

  static String get mongoUri {
    const value = String.fromEnvironment('MONGODB_URI');
    if (value.isEmpty) {
      // Re-configuring for standard Atlassrv connection with TLS
      return 'mongodb+srv://eslam1v:2tPMAytvUxLwFlcy@cluster0.ksezl1d.mongodb.net/gala_exams?retryWrites=true&w=majority&authSource=admin&tls=true&safeAtlas=true';
    }
    return value;
  }

  static String get groqApiKey {
    const value = String.fromEnvironment('GROQ_API_KEY');
    if (value.isEmpty) {
      // Embedding for local independent testing
      return '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';
    }
    return value;
  }
}
