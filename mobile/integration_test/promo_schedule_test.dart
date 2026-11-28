// The promo slot's schedule: which card Home shows after how many actions,
// and when a closed one comes back. Pure logic over SharedPreferences, so it
// runs on the host without a device:
//
//   flutter test integration_test/promo_schedule_test.dart
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:radio_crestin/services/announcement.dart';
import 'package:radio_crestin/services/announcements_service.dart';
import 'package:radio_crestin/services/home_promo_slot.dart';
import 'package:radio_crestin/services/promo_notification_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _share = PromoNotificationService.shareCardId;
const _car = PromoNotificationService.carCardId;

late SharedPreferences _prefs;

Future<void> _start([Map<String, Object> values = const {}]) async {
  SharedPreferences.setMockInitialValues(values);
  _prefs = await SharedPreferences.getInstance();
}

Future<void> _setActions(int actions) => _prefs.setString(
    '_reviewStatus', json.encode({'actions_made': actions}));

/// The id of the card the slot shows at [actions], or null.
Future<String?> _shownAt(int actions) async {
  await _setActions(actions);
  final promo = await HomePromoSlot(_prefs).current();
  return switch (promo) {
    NotificationPromo(:final notification) => notification.id,
    _ => null,
  };
}

/// Closes the card on screen at [actions].
Future<void> _closeAt(int actions) async {
  await _setActions(actions);
  final slot = HomePromoSlot(_prefs);
  final promo = await slot.current();
  expect(promo, isA<NotificationPromo>(), reason: 'a card to close');
  await slot.close(promo!);
}

void main() {
  group('the share card is a promo notification', () {
    test('of kind share, with a redisplay schedule', () {
      final share = PromoNotificationService.byId(_share)!;
      expect(share.kind, PromoKind.share);
      expect(share.minActions, 40);
      expect(share.redisplayAfterActions, [150, 400, 800]);
      expect(share.maxShows, 4);
      // Other cards keep the old behaviour: once closed, gone.
      expect(PromoNotificationService.byId(_car)!.redisplayAfterActions,
          isEmpty);
    });
  });

  group('HomePromoSlot', () {
    test('shows the share card first at its threshold', () async {
      // The car card is out of the way, as for a listener who used CarPlay.
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      expect(await _shownAt(0), isNull);
      expect(await _shownAt(39), isNull);
      expect(await _shownAt(40), _share);
    });

    test('keeps the card on screen until it is closed', () async {
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      expect(await _shownAt(40), _share);
      expect(await _shownAt(41), _share);
      expect(await _shownAt(500), _share);
    });

    test('shows the share card again after each wait, then never', () async {
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      await _closeAt(40);
      expect(await _shownAt(189), isNull);
      expect(await _shownAt(190), _share, reason: '40 + 150');
      await _closeAt(200);
      expect(await _shownAt(599), isNull);
      expect(await _shownAt(600), _share, reason: '200 + 400');
      await _closeAt(600);
      expect(await _shownAt(1399), isNull);
      expect(await _shownAt(1400), _share, reason: '600 + 800');
      await _closeAt(1400);
      // The schedule is used up: four shows in all.
      expect(PromoNotificationService(_prefs).closesOf(_share), 4);
      expect(await _shownAt(5000), isNull);
      expect(await _shownAt(100000), isNull);
    });

    test('the car card never comes back once closed', () async {
      await _start();
      expect(await _shownAt(25), _car);
      await _closeAt(25);
      expect(PromoNotificationService(_prefs).isFinished(_car), isTrue);
      // The share card's turn comes, the car card's never again.
      expect(await _shownAt(45), _share);
      await _closeAt(45);
      expect(await _shownAt(194), isNull);
      expect(await _shownAt(195), _share, reason: 'only the share card');
    });

    test('waits the gap between two cards', () async {
      await _start();
      expect(await _shownAt(40), _car, reason: 'the first one due');
      await _closeAt(40);
      expect(await _shownAt(40), isNull);
      expect(await _shownAt(40 + HomePromoSlot.gapActions - 1), isNull);
      expect(await _shownAt(40 + HomePromoSlot.gapActions), _share);
    });

    test('the gap holds a redisplay back too', () async {
      // The share card is due 150 actions after its close, but the car card
      // closed later starts its own gap.
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      await _closeAt(40);
      await _prefs.setInt('promo_card_closed_at_actions', 185);
      expect(await _shownAt(190), isNull);
      expect(await _shownAt(205), _share);
    });

    test('a card taken away while on screen leaves the slot', () async {
      await _start();
      expect(await _shownAt(30), _car);
      // The listener connected to CarPlay.
      await PromoNotificationService(_prefs).dismiss(_car);
      expect(await _shownAt(30), isNull);
      expect(await _shownAt(40), _share);
    });

    test('announcements win over a card on screen', () async {
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      expect(await _shownAt(40), _share);
      final announcements = AnnouncementList(
        [Announcement.fromJson({'slug': 'news', 'title': 'News'})!],
        const AnnouncementSettings(),
      );
      expect(
        await HomePromoSlot(_prefs).current(announcements: announcements),
        isA<AnnouncementPromo>(),
      );
      // Once they are gone, the share card is back, not closed.
      expect(await _shownAt(41), _share);
    });
  });

  group('a share announcement from the API', () {
    Future<String?> shownWithApiShare(int actions) async {
      await _setActions(actions);
      final promo = await HomePromoSlot(_prefs).current(shareFromApi: true);
      return switch (promo) {
        NotificationPromo(:final notification) => notification.id,
        _ => null,
      };
    }

    test('keeps the built-in share card from showing', () async {
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      expect(await shownWithApiShare(40), isNull);
      expect(await shownWithApiShare(5000), isNull);
      // Once the API stops asking, the built-in card's turn comes.
      expect(await _shownAt(5000), _share);
    });

    test('hides a share card on screen until the announcement goes',
        () async {
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      expect(await _shownAt(40), _share);
      expect(await shownWithApiShare(41), isNull);
      expect(PromoNotificationService(_prefs).closesOf(_share), 0);
      expect(await _shownAt(42), _share);
    });

    test('still lets the car card show', () async {
      await _start();
      expect(await shownWithApiShare(30), _car);
    });
  });

  group('migration from the old share prefs', () {
    test('a share card on screen stays on screen', () async {
      await _start({
        'show_share_promotion': true,
        'share_promotion_auto_enabled': true,
      });
      // Before the threshold and with the car card due: still the share card.
      expect(await _shownAt(30), _share);
      expect(_prefs.containsKey('show_share_promotion'), isFalse);
      expect(_prefs.containsKey('share_promotion_auto_enabled'), isFalse);
      await _closeAt(60);
      expect(PromoNotificationService(_prefs).closesOf(_share), 1);
      // The car card waited behind it, and gets the slot after the gap.
      expect(await _shownAt(79), isNull);
      expect(await _shownAt(80), _car);
    });

    test('a closed share card comes back on the schedule, not now', () async {
      await _start({
        'show_share_promotion': false,
        'share_promotion_auto_enabled': true,
        'promo_card_closed_at_actions': 300,
        'promo_notifications_dismissed': [_car],
      });
      expect(await _shownAt(320), isNull);
      expect(await _shownAt(449), isNull);
      expect(await _shownAt(450), _share, reason: '300 + 150');
      expect(PromoNotificationService(_prefs).closesOf(_share), 1);
    });

    test('a closed share card without a close count waits from now',
        () async {
      await _start({
        'show_share_promotion': false,
        'share_promotion_auto_enabled': true,
        'promo_notifications_dismissed': [_car],
      });
      expect(await _shownAt(1000), isNull);
      expect(await _shownAt(1149), isNull);
      expect(await _shownAt(1150), _share);
    });

    test('runs once', () async {
      await _start({
        'show_share_promotion': true,
        'share_promotion_auto_enabled': true,
        'promo_notifications_dismissed': [_car],
      });
      await _closeAt(50);
      expect(await _shownAt(51), isNull);
      expect(PromoNotificationService(_prefs).closesOf(_share), 1);
    });

    test('a listener who never saw it gets it at the threshold', () async {
      await _start({
        'promo_notifications_dismissed': [_car],
      });
      expect(await _shownAt(39), isNull);
      expect(await _shownAt(40), _share);
    });
  });
}
