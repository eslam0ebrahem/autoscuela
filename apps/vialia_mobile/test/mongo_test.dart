import 'package:mongo_dart/mongo_dart.dart';
import 'package:flutter/foundation.dart';

void main() async {
  final db = await Db.create(
    'mongodb+srv://eslam1v:2tPMAytvUxLwFlcy@cluster0.ksezl1d.mongodb.net/gala_exams?retryWrites=true&w=majority&authSource=admin&tls=true&safeAtlas=true&connectTimeoutMS=10000&socketTimeoutMS=60000',
  );
  await db.open(secure: true);
  debugPrint('Connected: ${db.isConnected}');
  final pingRes = await db.pingCommand();
  debugPrint('Ping result: $pingRes');
  await db.close();
}
