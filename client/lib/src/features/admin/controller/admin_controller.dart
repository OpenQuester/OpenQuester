import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';

@singleton
class AdminController extends ChangeNotifier {
  AdminDashboardData? _dashboardData;
  AdminUserListData? _userListData;
  AdminSystemHealthData? _systemHealthData;
  AdminPingData? _pingData;

  bool _isLoading = false;
  String? _error;

  AdminDashboardData? get dashboardData => _dashboardData;
  AdminUserListData? get userListData => _userListData;
  AdminSystemHealthData? get systemHealthData => _systemHealthData;
  AdminPingData? get pingData => _pingData;
  bool get isLoading => _isLoading;
  String? get error => _error;

  bool get hasAdminAccess =>
      _userHasPermission(PermissionName.adminPanelAccess);
  bool get canViewSystemHealth =>
      _userHasPermission(PermissionName.viewSystemHealth);
  bool get canViewUsersInfo => _userHasPermission(PermissionName.viewUsersInfo);
  bool get canBanUsers => _userHasPermission(PermissionName.banUsers);
  bool get canDeleteUsers =>
      _userHasPermission(PermissionName.deleteAnotherUser);

  bool _userHasPermission(PermissionName permissionName) {
    final user = ProfileController.getUser();
    if (user == null) return false;
    return user.permissions.any(
      (permission) => permission.name == permissionName,
    );
  }

  Future<void> loadDashboardData({int? timeframeDays}) async {
    if (!hasAdminAccess) {
      _error = LocaleKeys.admin_no_permission.tr();
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _dashboardData = await Api.I.api.admin.getV1AdminApiDashboard(
        timeframe: timeframeDays,
      );
      _error = null;
    } catch (e) {
      _error = Api.parseError(e) ?? LocaleKeys.admin_error_loading_data.tr();
      logger.e('Failed to load admin dashboard data', error: e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadUsersList({
    UsersSortBy? sortBy,
    OrderDirection? order,
    int? limit,
    int? offset,
  }) async {
    if (!canViewUsersInfo) {
      _error = LocaleKeys.admin_no_permission.tr();
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _userListData = await Api.I.api.admin.getV1AdminApiUsers(
        sortBy: sortBy,
        order: order,
        limit: limit,
        offset: offset,
      );
      _error = null;
    } catch (e) {
      _error = Api.parseError(e) ?? LocaleKeys.admin_error_loading_data.tr();
      logger.e('Failed to load users list', error: e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadSystemHealth() async {
    if (!canViewSystemHealth) {
      _error = LocaleKeys.admin_no_permission.tr();
      notifyListeners();
      return;
    }

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _systemHealthData = await Api.I.api.admin.getV1AdminApiSystemHealth();
      _error = null;
    } catch (e) {
      _error = Api.parseError(e) ?? LocaleKeys.admin_error_loading_data.tr();
      logger.e('Failed to load system health', error: e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadPing() async {
    if (!canViewSystemHealth) {
      _error = LocaleKeys.admin_no_permission.tr();
      notifyListeners();
      return;
    }

    try {
      _pingData = await Api.I.api.admin.getV1AdminApiSystemPing();
      notifyListeners();
    } catch (e) {
      logger.e('Failed to ping system', error: e);
    }
  }

  Future<bool> banUser(int userId) async {
    if (!canBanUsers) {
      await getIt<ToastController>().show(
        LocaleKeys.admin_no_permission.tr(),
      );
      return false;
    }

    try {
      await Api.I.api.admin.postV1AdminApiUsersIdBan(id: userId);
      await getIt<ToastController>().show(
        LocaleKeys.admin_user_banned_success.tr(),
      );
      return true;
    } catch (e) {
      await getIt<ToastController>().show(
        Api.parseError(e) ?? LocaleKeys.something_went_wrong.tr(),
      );
      logger.e('Failed to ban user', error: e);
      return false;
    }
  }

  Future<bool> unbanUser(int userId) async {
    if (!canBanUsers) {
      await getIt<ToastController>().show(
        LocaleKeys.admin_no_permission.tr(),
      );
      return false;
    }

    try {
      await Api.I.api.admin.postV1AdminApiUsersIdUnban(id: userId);
      await getIt<ToastController>().show(
        LocaleKeys.admin_user_unbanned_success.tr(),
      );
      return true;
    } catch (e) {
      await getIt<ToastController>().show(
        Api.parseError(e) ?? LocaleKeys.something_went_wrong.tr(),
      );
      logger.e('Failed to unban user', error: e);
      return false;
    }
  }

  Future<bool> deleteUser(int userId) async {
    if (!canDeleteUsers) {
      await getIt<ToastController>().show(
        LocaleKeys.admin_no_permission.tr(),
      );
      return false;
    }

    try {
      await Api.I.api.admin.deleteV1AdminApiUsersId(id: userId);
      await getIt<ToastController>().show(
        LocaleKeys.admin_user_deleted_success.tr(),
      );
      return true;
    } catch (e) {
      await getIt<ToastController>().show(
        Api.parseError(e) ?? LocaleKeys.something_went_wrong.tr(),
      );
      logger.e('Failed to delete user', error: e);
      return false;
    }
  }

  Future<bool> restoreUser(int userId) async {
    if (!canDeleteUsers) {
      await getIt<ToastController>().show(
        LocaleKeys.admin_no_permission.tr(),
      );
      return false;
    }

    try {
      await Api.I.api.admin.postV1AdminApiUsersRestoreId(id: userId);
      await getIt<ToastController>().show(
        LocaleKeys.admin_user_restored_success.tr(),
      );
      return true;
    } catch (e) {
      await getIt<ToastController>().show(
        Api.parseError(e) ?? LocaleKeys.something_went_wrong.tr(),
      );
      logger.e('Failed to restore user', error: e);
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
