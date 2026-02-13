import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:openquester/generated/locale_keys.g.dart';
import 'package:openquester/src/utils/locale_utils.dart';

Widget localizationWrapper(Widget child) {
  return EasyLocalization(
    supportedLocales: supportedLocales,
    path: 'assets/localization',
    fallbackLocale: supportedLocales.first,
    child: child,
  );
}

enum AppLocale {
  enUs(Locale('en', 'US'), LocaleKeys.language_english),
  ukUa(Locale('uk', 'UA'), LocaleKeys.language_ukrainian),
  ruRu(Locale('ru', 'RU'), LocaleKeys.language_russian);

  const AppLocale(this.locale, this.labelKey);

  final Locale locale;
  final String labelKey;

  String label() => labelKey.tr();

  String get tag => localeTag(locale);

  static AppLocale? fromLocale(Locale locale) {
    for (final value in AppLocale.values) {
      if (value.locale == locale) return value;
    }
    return null;
  }

  static AppLocale? fromTag(String? tag) {
    final parsed = parseLocaleTag(tag);
    if (parsed == null) return null;
    return fromLocale(parsed);
  }
}

final List<Locale> supportedLocales = AppLocale.values
    .map((e) => e.locale)
    .toList(growable: false);
