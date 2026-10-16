import 'package:flutter/material.dart';

final appTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  colorScheme: ColorScheme.fromSeed(
    seedColor: const Color(0xFF6C63FF),
    brightness: Brightness.dark,
    surface: const Color(0xFF121218),
    surfaceContainerHighest: const Color(0xFF1E1E2A),
  ),
  scaffoldBackgroundColor: const Color(0xFF121218),
  cardTheme: CardThemeData(
    color: const Color(0xFF1E1E2A),
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: Color(0xFF121218),
    elevation: 0,
    centerTitle: false,
    titleTextStyle: TextStyle(
      color: Colors.white,
      fontSize: 22,
      fontWeight: FontWeight.w700,
    ),
  ),
  bottomNavigationBarTheme: const BottomNavigationBarThemeData(
    backgroundColor: Color(0xFF1A1A26),
    selectedItemColor: Color(0xFF6C63FF),
    unselectedItemColor: Color(0xFF6B6B7E),
    type: BottomNavigationBarType.fixed,
    elevation: 0,
  ),
  dividerTheme: const DividerThemeData(
    color: Color(0xFF2A2A3A),
    thickness: 1,
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: const Color(0xFF1E1E2A),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFF2A2A3A)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFF2A2A3A)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: const BorderSide(color: Color(0xFF6C63FF)),
    ),
    labelStyle: const TextStyle(color: Color(0xFF8888A0)),
    hintStyle: const TextStyle(color: Color(0xFF6B6B7E)),
  ),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: const Color(0xFF6C63FF),
      foregroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
      textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
    ),
  ),
  textButtonTheme: TextButtonThemeData(
    style: TextButton.styleFrom(foregroundColor: const Color(0xFF6C63FF)),
  ),
  chipTheme: ChipThemeData(
    backgroundColor: const Color(0xFF2A2A3A),
    labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
  ),
);
