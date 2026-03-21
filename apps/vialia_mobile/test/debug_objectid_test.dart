// ignore_for_file: avoid_print
import 'package:flutter_test/flutter_test.dart';
import 'package:mongo_dart/mongo_dart.dart' as mongo;

void main() {
  test('Check ObjectId', () {
    final id = mongo.ObjectId();
    final raw = id.toString();
    final match = RegExp(r'[0-9a-fA-F]{24}').firstMatch(raw);
    final normalized = match?.group(0)?.toLowerCase() ?? raw;
    print('id.oid = ${id.oid}');
    print('raw = $raw');
    print('normalized = $normalized');
    print('Equal? ${id.oid == normalized}');
  });
}
