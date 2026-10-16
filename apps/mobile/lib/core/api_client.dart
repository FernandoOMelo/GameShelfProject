import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'local_db.dart';

const _kServerUrlKey = 'server_url';
const _kDefaultUrl = 'http://192.168.1.1:3000';

class ApiClient {
  static ApiClient? _instance;
  late Dio _dio;
  String _baseUrl = _kDefaultUrl;

  ApiClient._();

  static ApiClient get instance {
    _instance ??= ApiClient._();
    return _instance!;
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString(_kServerUrlKey) ?? _kDefaultUrl;
    _buildDio();
  }

  void _buildDio() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.trimRight().replaceAll(RegExp(r'/$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kServerUrlKey, _baseUrl);
    _buildDio();
  }

  String get baseUrl => _baseUrl;

  Dio get dio => _dio;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters}) =>
      _dio.get<T>(path, queryParameters: queryParameters);

  Future<T> getCached<T>(String path, {Map<String, dynamic>? queryParameters}) async {
    final key = _cacheKey(path, queryParameters);
    try {
      final response = await _dio.get<T>(path, queryParameters: queryParameters);
      await LocalDb.instance.cacheResponse(key, jsonEncode(response.data));
      return response.data as T;
    } on DioException catch (error) {
      if (!_isUnreachable(error)) rethrow;
      final cached = await LocalDb.instance.cachedResponse(key);
      if (cached == null) rethrow;
      return jsonDecode(cached.body) as T;
    }
  }

  Future<DateTime?> cachedAt(String path, {Map<String, dynamic>? queryParameters}) async {
    final cached = await LocalDb.instance.cachedResponse(_cacheKey(path, queryParameters));
    return cached?.cachedAt;
  }

  String _cacheKey(String path, Map<String, dynamic>? queryParameters) {
    if (queryParameters == null || queryParameters.isEmpty) return path;
    final entries = queryParameters.entries.map((entry) => '${entry.key}=${entry.value}').toList()..sort();
    return '$path?${entries.join('&')}';
  }

  bool _isUnreachable(DioException error) => const {
        DioExceptionType.connectionError,
        DioExceptionType.connectionTimeout,
        DioExceptionType.receiveTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.unknown,
      }.contains(error.type);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post<T>(path, data: data);

  Future<Response<T>> patch<T>(String path, {dynamic data}) =>
      _dio.patch<T>(path, data: data);

  Future<Response<T>> delete<T>(String path) =>
      _dio.delete<T>(path);

  Future<Response<T>> put<T>(String path, {dynamic data}) =>
      _dio.put<T>(path, data: data);
}
