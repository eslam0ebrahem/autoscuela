class AppConfig {
  const AppConfig._();

  static String get mongoUri {
    const value = String.fromEnvironment('MONGODB_URI');
    if (value.isEmpty) {
      // Standard Atlas SRV connection with safeAtlas=true as recommended by driver for concurrent requests
      return 'mongodb+srv://eslam1v:2tPMAytvUxLwFlcy@cluster0.ksezl1d.mongodb.net/gala_exams?retryWrites=true&w=majority&authSource=admin&tls=true&safeAtlas=true&connectTimeoutMS=10000&socketTimeoutMS=60000';
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
