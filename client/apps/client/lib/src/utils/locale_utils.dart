import 'package:flutter/material.dart';

Locale? parseLocaleTag(String? tag) {
  if (tag == null || tag.isEmpty) return null;
  final normalized = tag.replaceAll('_', '-');
  final parts = normalized.split('-');
  if (parts.isEmpty) return null;
  final languageCode = parts.first;
  if (languageCode.isEmpty) return null;
  final countryCode = parts.length > 1 && parts[1].isNotEmpty ? parts[1] : null;
  return Locale(languageCode, countryCode);
}

String localeTag(Locale locale) {
  final countryCode = locale.countryCode;
  if (countryCode == null || countryCode.isEmpty) {
    return locale.languageCode;
  }
  return '${locale.languageCode}-$countryCode';
}
