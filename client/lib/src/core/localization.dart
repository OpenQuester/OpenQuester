import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

Widget localizationWrapper(Widget child) {
  return EasyLocalization(
    supportedLocales: supportedLocales,
    path: 'assets/localization',
    fallbackLocale: supportedLocales.first,
    child: child,
  );
}

const List<Locale> supportedLocales = [
  Locale('en', 'US'),
  Locale('uk', 'UA'),
  Locale('ru', 'RU'),
];
