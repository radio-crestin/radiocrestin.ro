import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// What a [PromoNotification] card shows besides its title and message.
enum PromoKind {
  /// The Apple CarPlay and Android Auto badges.
  car,

  /// The share link with its WhatsApp, Facebook and share sheet buttons.
  share,
}

/// A card the home screen shows in its promo slot once the listener has
/// made [minActions] actions, and again after each close as long as
/// [redisplayAfterActions] has a wait left.
class PromoNotification {
  final String id;
  final PromoKind kind;

  /// The card's title; the share card shows the API's own when it has one.
  final String title;

  /// The card's message; the share card shows the API's own when it has
  /// one.
  final String message;

  /// User actions before the card first shows.
  final int minActions;

  /// User actions to wait after each close before the card shows again:
  /// the first entry after the first close, the second after the second,
  /// and so on. Once they are used up the card is gone for good, so the
  /// card shows `1 + redisplayAfterActions.length` times at most. Empty
  /// (the default): it never comes back once closed.
  final List<int> redisplayAfterActions;

  const PromoNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.message,
    this.minActions = 0,
    this.redisplayAfterActions = const [],
  });

  /// How many times the card can show at most.
  int get maxShows => 1 + redisplayAfterActions.length;
}

/// The registry of [PromoNotification] cards and what the listener did with
/// each: how many times they closed it and at which action count.
class PromoNotificationService {
  /// Ids closed for good: the cards closed before redisplay existed, and the
  /// ones [dismiss] takes away.
  static const String _dismissedKey = 'promo_notifications_dismissed';

  /// Per card id: `{"closes": n, "closedAt": actions}`.
  static const String _historyKey = 'promo_notifications_history';

  /// The card inviting the listener to CarPlay and Android Auto.
  static const String carCardId = 'carplay_android_auto_v1';

  /// The card asking the listener to share the app with friends.
  static const String shareCardId = 'share_app';

  static const PromoNotification carCard = PromoNotification(
    id: carCardId,
    kind: PromoKind.car,
    title: 'Ascultă Radio Creștin în mașină',
    message: 'Conectează telefonul prin Apple CarPlay sau Android Auto și '
        'bucură-te de toate stațiile tale preferate pe drum.',
    minActions: 25,
  );

  static const PromoNotification shareCard = PromoNotification(
    id: shareCardId,
    kind: PromoKind.share,
    title: 'Distribuie aplicația',
    message: 'Ajută la răspândirea Evangheliei prin intermediul radioului '
        'creștin. Apasă aici pentru a trimite această aplicație prietenilor '
        'tăi.',
    minActions: 40,
    redisplayAfterActions: [150, 400, 800],
  );

  /// All registered notifications, in display order: when several are due,
  /// the first one shows.
  static const List<PromoNotification> notifications = [carCard, shareCard];

  /// The registered notification with [id], or null.
  static PromoNotification? byId(String id) {
    for (final notification in notifications) {
      if (notification.id == id) return notification;
    }
    return null;
  }

  final SharedPreferences _prefs;

  PromoNotificationService(this._prefs);

  /// The first notification due now, or null; notifications of a kind in
  /// [skip] are left out.
  PromoNotification? getNextNotification({Set<PromoKind> skip = const {}}) {
    final actions = actionsMade;
    for (final notification in notifications) {
      if (skip.contains(notification.kind)) continue;
      final due = dueAt(notification);
      if (due != null && actions >= due) return notification;
    }
    return null;
  }

  /// The action count from which [notification] can show, or null when it
  /// never shows again.
  int? dueAt(PromoNotification notification) {
    if (_dismissedIds().contains(notification.id)) return null;
    final closes = closesOf(notification.id);
    if (closes == 0) return notification.minActions;
    if (closes > notification.redisplayAfterActions.length) return null;
    final closedAt = _history()[notification.id]?['closedAt'] ?? 0;
    return closedAt + notification.redisplayAfterActions[closes - 1];
  }

  /// Whether [id] can never show again.
  bool isFinished(String id) {
    final notification = byId(id);
    return notification == null || dueAt(notification) == null;
  }

  /// How many times the listener closed the card [id].
  int closesOf(String id) => _history()[id]?['closes'] ?? 0;

  /// The listener closed the card [id]: it comes back after its next wait in
  /// [PromoNotification.redisplayAfterActions], if it has one left.
  ///
  /// [atActions] is the action count it was closed at, the current one by
  /// default.
  Future<void> close(String id, {int? atActions}) async {
    final history = _history();
    history[id] = {
      'closes': (history[id]?['closes'] ?? 0) + 1,
      'closedAt': atActions ?? actionsMade,
    };
    await _prefs.setString(_historyKey, json.encode(history));
  }

  /// Takes the notification [id] away for good, whatever its schedule.
  Future<void> dismiss(String notificationId) async {
    final dismissed = _dismissedIds();
    dismissed.add(notificationId);
    await _prefs.setStringList(_dismissedKey, dismissed.toList());
  }

  Set<String> _dismissedIds() =>
      (_prefs.getStringList(_dismissedKey) ?? const []).toSet();

  Map<String, Map<String, int>> _history() {
    final raw = _prefs.getString(_historyKey);
    if (raw == null) return {};
    try {
      final decoded = json.decode(raw) as Map<String, dynamic>;
      return {
        for (final MapEntry(:key, :value) in decoded.entries)
          if (value is Map)
            key: {
              for (final MapEntry(key: field, value: number) in value.entries)
                if (field is String && number is int) field: number,
            },
      };
    } catch (_) {
      return {};
    }
  }

  /// The user actions counted so far; 0 when they cannot be read.
  int get actionsMade {
    final reviewStatusJson = _prefs.getString('_reviewStatus');
    if (reviewStatusJson == null) return 0;
    try {
      final status = json.decode(reviewStatusJson) as Map<String, dynamic>;
      return (status['actions_made'] as int?) ?? 0;
    } catch (_) {
      return 0;
    }
  }
}
