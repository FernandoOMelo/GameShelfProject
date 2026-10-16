import 'dart:convert';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

class OfflineOp {
  final int? id;
  final String method;
  final String path;
  final Map<String, dynamic> body;
  final int createdAt;

  const OfflineOp({
    this.id,
    required this.method,
    required this.path,
    required this.body,
    required this.createdAt,
  });

  Map<String, dynamic> toRow() => {
        if (id != null) 'id': id,
        'method': method,
        'path': path,
        'body': jsonEncode(body),
        'created_at': createdAt,
      };

  factory OfflineOp.fromRow(Map<String, dynamic> row) => OfflineOp(
        id: row['id'] as int,
        method: row['method'] as String,
        path: row['path'] as String,
        body: jsonDecode(row['body'] as String) as Map<String, dynamic>,
        createdAt: row['created_at'] as int,
      );
}

class CachedResponse {
  final String body;
  final DateTime cachedAt;

  const CachedResponse({required this.body, required this.cachedAt});
}

const _createOfflineOps = '''
  CREATE TABLE offline_ops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
''';

const _createCachedResponses = '''
  CREATE TABLE cached_responses (
    path TEXT PRIMARY KEY,
    body TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  )
''';

class LocalDb {
  static LocalDb? _instance;
  Database? _db;

  LocalDb._();

  static LocalDb get instance {
    _instance ??= LocalDb._();
    return _instance!;
  }

  Future<Database> get db async {
    _db ??= await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dbPath = await getDatabasesPath();
    return openDatabase(
      join(dbPath, 'gameshelf.db'),
      version: 2,
      onCreate: (db, _) async {
        await db.execute(_createOfflineOps);
        await db.execute(_createCachedResponses);
      },
      onUpgrade: (db, oldVersion, _) async {
        if (oldVersion < 2) await db.execute(_createCachedResponses);
      },
    );
  }

  Future<void> cacheResponse(String path, String body) async {
    final database = await db;
    await database.insert(
      'cached_responses',
      {'path': path, 'body': body, 'cached_at': DateTime.now().millisecondsSinceEpoch},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<CachedResponse?> cachedResponse(String path) async {
    final database = await db;
    final rows = await database.query('cached_responses', where: 'path = ?', whereArgs: [path], limit: 1);
    if (rows.isEmpty) return null;
    return CachedResponse(
      body: rows.first['body'] as String,
      cachedAt: DateTime.fromMillisecondsSinceEpoch(rows.first['cached_at'] as int),
    );
  }

  Future<int> enqueue(OfflineOp op) async {
    final database = await db;
    return database.insert('offline_ops', op.toRow());
  }

  Future<List<OfflineOp>> pendingOps() async {
    final database = await db;
    final rows = await database.query('offline_ops', orderBy: 'created_at ASC');
    return rows.map(OfflineOp.fromRow).toList();
  }

  Future<void> deleteOp(int id) async {
    final database = await db;
    await database.delete('offline_ops', where: 'id = ?', whereArgs: [id]);
  }

  Future<int> pendingCount() async {
    final database = await db;
    final result = await database.rawQuery('SELECT COUNT(*) as c FROM offline_ops');
    return (result.first['c'] as int?) ?? 0;
  }
}
