import 'package:freezed_annotation/freezed_annotation.dart';

part 'package_upload_cart.freezed.dart';
part 'package_upload_cart.g.dart';

@freezed
abstract class PackageUploadCart with _$PackageUploadCart {
  const factory PackageUploadCart({required String hash}) = _PackageUploadCart;

  factory PackageUploadCart.fromJson(Map<String, dynamic> json) =>
      _$PackageUploadCartFromJson(json);
}
