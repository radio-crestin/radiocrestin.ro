import 'package:shared_preferences/shared_preferences.dart';

import 'announcements_service.dart';
import 'promo_notification_service.dart';

/// A card the home screen shows above the station list.
sealed class HomePromo {
  const HomePromo();
}

/// A [PromoNotification] card: the share card or the CarPlay and Android
/// Auto one.
class NotificationPromo extends HomePromo {
  const NotificationPromo(this.notification);

  final PromoNotification notification;
}

/// The announcements from the API, which take the slot whenever there
/// are any.
class AnnouncementPromo extends HomePromo {
  const AnnouncementPromo(this.announcements);

  final AnnouncementList announcements;
}

/// Picks the one promo card the home screen shows above the station list.
///
/// Two cards at once push the stations off the screen, so they take
/// turns: the card on screen stays until the user closes it, and the next
/// one waits [gapActions] more actions, so closing a card never brings
/// another one right away. A closed card comes back on its own schedule
/// ([PromoNotification.redisplayAfterActions]).
class HomePromoSlot {
  HomePromoSlot(this._prefs)
      : _notifications = PromoNotificationService(_prefs);

  /// User actions between closing one card and showing the next.
  static const int gapActions = 20;

  static const _closedAtKey = 'promo_card_closed_at_actions';

  /// The id of the notification on screen, kept until the user closes it.
  static const _currentKey = 'promo_card_current';

  /// The share card before it was a [PromoNotification]: on until closed,
  /// and shown once.
  static const _legacyShareOnKey = 'show_share_promotion';
  static const _legacyShareShownKey = 'share_promotion_auto_enabled';

  final SharedPreferences _prefs;
  final PromoNotificationService _notifications;

  /// The card to show now, or null; puts the next notification in the slot
  /// when its turn comes.
  ///
  /// [announcements] from the API come first: they are what the team
  /// wants seen now. Otherwise the notification already on screen keeps the
  /// slot until it is closed.
  Future<HomePromo?> current({
    AnnouncementList announcements = AnnouncementList.empty,
  }) async {
    await _migrateLegacyShare();
    if (announcements.items.isNotEmpty) {
      return AnnouncementPromo(announcements);
    }
    final shownId = _prefs.getString(_currentKey);
    if (shownId != null) {
      final shown = PromoNotificationService.byId(shownId);
      if (shown != null && !_notifications.isFinished(shownId)) {
        return NotificationPromo(shown);
      }
      // Gone from the registry, or taken away meanwhile (the car card once
      // the listener used CarPlay).
      await _prefs.remove(_currentKey);
    }
    final closedAt = _prefs.getInt(_closedAtKey);
    if (closedAt != null &&
        _notifications.actionsMade < closedAt + gapActions) {
      return null;
    }
    final next = _notifications.getNextNotification();
    if (next == null) return null;
    await _prefs.setString(_currentKey, next.id);
    return NotificationPromo(next);
  }

  /// Hides [promo] until its next turn, if it has one, and starts the wait
  /// before the next card.
  ///
  /// An [AnnouncementPromo] closes one announcement at a time, on the
  /// card; this only starts the wait once the last one is gone.
  Future<void> close(HomePromo promo) async {
    switch (promo) {
      case AnnouncementPromo():
        break;
      case NotificationPromo(:final notification):
        await _notifications.close(notification.id);
        if (_prefs.getString(_currentKey) == notification.id) {
          await _prefs.remove(_currentKey);
        }
    }
    await _prefs.setInt(_closedAtKey, _notifications.actionsMade);
  }

  /// Carries the share card's old prefs over to the notification registry,
  /// once: a share card on screen stays on screen, and one already closed
  /// counts as shown once, so it comes back on the schedule instead of now.
  Future<void> _migrateLegacyShare() async {
    final on = _prefs.getBool(_legacyShareOnKey);
    final shown = _prefs.getBool(_legacyShareShownKey);
    if (on == null && shown == null) return;
    const shareId = PromoNotificationService.shareCardId;
    if (_notifications.closesOf(shareId) == 0) {
      if (on ?? false) {
        await _prefs.setString(_currentKey, shareId);
      } else if (shown ?? false) {
        // It was closed at some point before; the last close is the best
        // guess at when.
        await _notifications.close(
          shareId,
          atActions:
              _prefs.getInt(_closedAtKey) ?? _notifications.actionsMade,
        );
      }
    }
    await _prefs.remove(_legacyShareOnKey);
    await _prefs.remove(_legacyShareShownKey);
  }
}
