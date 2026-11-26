import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:radio_crestin/appAudioHandler.dart';

import 'package:get_it/get_it.dart';
import 'package:radio_crestin/components/StationsList.dart';
import 'package:radio_crestin/services/announcement.dart';
import 'package:radio_crestin/services/announcement_hide_rules.dart';
import 'package:radio_crestin/pages/StoryViewerPage.dart';
import 'package:radio_crestin/services/announcements_service.dart';
import 'package:radio_crestin/services/home_promo_slot.dart';
import 'package:radio_crestin/services/story.dart';
import 'package:radio_crestin/services/story_cta.dart';
import 'package:radio_crestin/services/story_deep_link.dart';
import 'package:radio_crestin/utils.dart';
import 'package:radio_crestin/widgets/story_comments.dart';
import 'package:radio_crestin/widgets/story_overlay.dart';
import 'package:radio_crestin/services/story_schedule.dart';
import 'package:radio_crestin/services/story_viewer_controller.dart';
import 'package:radio_crestin/theme.dart';
import 'package:radio_crestin/widgets/announcement_banner.dart';
import 'package:radio_crestin/widgets/announcement_card.dart';
import 'package:radio_crestin/widgets/announcement_icons.dart';
import 'package:radio_crestin/widgets/announcement_theme_colors.dart';
import 'package:radio_crestin/widgets/inline_markdown.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import 'harness/announcement_fixtures.dart';
import 'harness/announcement_hide_rule_cases.dart';
import 'harness/fake_radio_server.dart';
import 'harness/network_conditions.dart';
import 'harness/recording_launcher.dart';
import 'harness/radio_app.dart';
import 'harness/station_catalog.dart';
import 'harness/story_fixtures.dart';

/// The app's core flows, end to end, on good and bad networks. How the
/// harness works and how to add a test: README.md next to this file.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late FakeRadioServer server;
  setUpAll(() async {
    server = await FakeRadioServer.start();
    // The first test launches the app, on an API this slow.
    server.conditions.set(
      const Link(latency: Duration(seconds: 3)),
      origins: [Origin.api],
    );
  });
  tearDownAll(() => server.close());

  void test(
    String description,
    Future<void> Function(RadioApp app) body, {
    bool skip = false,
  }) =>
      e2eTest(description, body, server: () => server, skip: skip);

  group('Start', () {
    test('shows every station, even when the API answers slowly',
        (app) async {
      for (final station in Stations.all) {
        final row = await app.showStation(station);
        expect(row, findsOneWidget, reason: app.describe());
      }
      await app.expectSilent();
    });
  });

  group('Playback', () {
    test('tapping a station plays it', (app) async {
      final tappedAt = await app.tapStation(Stations.alpha);
      await app.expectPlaying(Stations.alpha, since: tappedAt);
    });

    test('pause silences the station and play resumes it', (app) async {
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));

      await app.tapMiniPlayerButton();
      await app.expectSilent();

      final resumedAt = DateTime.now();
      await app.tapMiniPlayerButton();
      await app.expectPlaying(Stations.alpha, since: resumedAt);
    });

    test('tapping another station switches the audio to it', (app) async {
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));

      final switchedAt = await app.tapStation(Stations.beta);
      await app.expectPlaying(Stations.beta, since: switchedAt);
      await app.pumpFor(const Duration(seconds: 2));
      final settledAt = DateTime.now();
      await app.pumpFor(const Duration(seconds: 6));
      expect(server.mediaBytesSent(Stations.alpha, since: settledAt), 0,
          reason: 'the previous station stopped streaming');
    });

    test('"Folosește MP3 cu prioritate" moves the station to MP3 and back',
        (app) async {
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));
      await app.openSettings();
      await app.toggleSetting('Mod dezvoltator');

      final mp3At = await app.toggleSetting('Folosește MP3 cu prioritate');
      await app.expectPlayingFrom(Stations.alpha, Origin.mp3, since: mp3At);

      final hlsAt = await app.toggleSetting('Folosește MP3 cu prioritate');
      await app.expectPlayingFrom(Stations.alpha, Origin.hls, since: hlsAt);
    });

    test('playing a search result ends the search', (app) async {
      await app.tapTooltip('Caută stații sau melodii');
      await app.pumpFor(const Duration(seconds: 1));
      await app.tester.enterText(find.byType(TextField), Stations.beta.title);
      await app.pumpFor(const Duration(seconds: 1));

      final tappedAt = await app.tapStation(Stations.beta);
      await app.waitFor(() => find.byType(TextField).evaluate().isEmpty,
          reason: 'the search field to give the app bar back');
      expect(find.byTooltip('Caută stații sau melodii').hitTestable(),
          findsOneWidget,
          reason: 'the search button is back');
      await app.expectPlaying(Stations.beta, since: tappedAt);
    });

    test('a station with only an MP3 stream plays it', (app) async {
      final tappedAt = await app.tapStation(Stations.gamma);
      await app.expectPlaying(Stations.gamma, since: tappedAt);
    });

    test('next and previous in the full player switch stations',
        (app) async {
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));
      await app.openFullPlayer();

      final nextAt = await app.tapTooltip('Stația următoare');
      await app.waitFor(() => app.currentStation != Stations.alpha,
          reason: 'next to change the station');
      await app.expectPlaying(app.currentStation, since: nextAt);

      await app.expectPlaying(Stations.alpha,
          since: await app.tapTooltip('Stația anterioară'));
    });
  });

  group('Bad network', () {
    test('starts and keeps playing on a slow mobile network', (app) async {
      server.conditions.set(
        const Link(latency: Duration(milliseconds: 600), bytesPerSecond: 16000),
      );
      final tappedAt = await app.tapStation(Stations.alpha);
      await app.expectPlaying(Stations.alpha,
          since: tappedAt,
          within: const Duration(seconds: 30),
          listenFor: const Duration(seconds: 20));
    });

    test('keeps playing through a 20-second stall of the stream',
        (app) async {
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));

      server.conditions.set(
        const Link(outage: Outage.silent),
        origins: [Origin.hls],
      );
      await app.expectAudioAdvances(const Duration(seconds: 20));
      server.conditions.restore();
      await app.expectAudioAdvances(const Duration(seconds: 10));
    });

    test('falls back to the MP3 stream when HLS is down', (app) async {
      server.conditions.set(
        const Link(outage: Outage.serverError),
        origins: [Origin.hls],
      );
      final tappedAt = await app.tapStation(Stations.alpha);
      await app.expectPlaying(Stations.alpha, since: tappedAt);
      expect(
        server.requests.any((r) =>
            r.origin == Origin.mp3 &&
            r.station == Stations.alpha.slug &&
            r.bytesSent > 0),
        isTrue,
        reason: 'the audio came from the MP3 stream',
      );
    });

    test('a station with only an MP3 stream plays when it is slow to start',
        (app) async {
      // On iPhone, AVPlayer opens an MP3 stream in two or three requests,
      // one after the other: its load takes 8-12 s, longer than the 5 s a
      // load may take when another stream could take over (a 320 kb/s
      // stream on mobile data).
      server.conditions.set(
        const Link(latency: Duration(seconds: 4)),
        origins: [Origin.mp3],
      );
      final errors = <ConnectionError>[];
      final errorsShown = app.audio.connectionError.listen(errors.add);
      addTearDown(errorsShown.cancel);

      final tappedAt = await app.tapStation(Stations.gamma);
      await app.expectPlaying(Stations.gamma,
          since: tappedAt, within: const Duration(seconds: 30));
      expect(errors, isEmpty,
          reason: 'no connection error while the station was loading');
    });

    test('reconnects by itself after the connection drops', (app) async {
      await app.expectPlaying(Stations.gamma,
          since: await app.tapStation(Stations.gamma));

      server.conditions.set(
        const Link(outage: Outage.refused),
        origins: [Origin.mp3],
      );
      await app.pumpFor(const Duration(seconds: 8));
      final restoredAt = DateTime.now();
      server.conditions.restore();
      await app.expectPlaying(Stations.gamma,
          since: restoredAt, within: const Duration(seconds: 45));
    });

    test('resumes by itself when the internet comes back', (app) async {
      await app.expectPlaying(Stations.gamma,
          since: await app.tapStation(Stations.gamma));

      server.conditions.goOffline();
      await app.waitFor(() => app.network.isOffline.value,
          reason: 'the app to notice it is offline',
          timeout: const Duration(seconds: 30));
      final restoredAt = DateTime.now();
      server.conditions.restore();
      await app.expectPlaying(Stations.gamma,
          since: restoredAt, within: const Duration(seconds: 60));
    });

    test('a station tapped while offline plays once the internet is back',
        (app) async {
      server.conditions.goOffline();
      await app.tapStation(Stations.beta);
      await app.pumpFor(const Duration(seconds: 8));
      final restoredAt = DateTime.now();
      server.conditions.restore();
      await app.expectPlaying(Stations.beta,
          since: restoredAt, within: const Duration(seconds: 60));
    });

    test('keeps playing while the API is down', (app) async {
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));

      server.conditions.set(
        const Link(outage: Outage.serverError),
        origins: [Origin.api, Origin.images],
      );
      await app.expectAudioAdvances(const Duration(seconds: 30));
    });
  });

  group('Announcements', () {
    /// Runs [body] from a device that never saw an announcement, and
    /// leaves none behind for the tests after it.
    void announcementTest(
      String description,
      Future<void> Function(RadioApp app) body,
    ) =>
        test(description, (app) async {
          await _forgetAnnouncements(app);
          try {
            await body(app);
          } finally {
            server.announcements.clear();
            await _forgetAnnouncements(app);
          }
        });

    /// Serves the two home fixtures and pulls Home to refresh, which shows
    /// new announcements at once.
    Future<void> showAnnouncements(RadioApp app) async {
      server.announcements
        ..add(AnnouncementFixtures.verse())
        ..add(AnnouncementFixtures.concert());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the announcement card to show');
    }

    announcementTest(
        'a first launch has the card in its first home frame, with the '
        'stations', (app) async {
      // A healthy API, even when this test is the run's first, slow one.
      server.conditions.restore();
      server.announcements.add(AnnouncementFixtures.verse());
      // No list kept on the device: the launch asks the API.
      await app.coldStartAnnouncements();
      expect(app.cardInFirstHomeFrame, isTrue,
          reason: 'the card is there from the first frame; ${app.describe()}');
      expect(app.showsText(AnnouncementFixtures.verseTitle), isTrue);
    });

    announcementTest('a cold start has the kept card in its first home frame',
        (app) async {
      server.announcements.add(AnnouncementFixtures.verse());
      await app.coldStartAnnouncements();
      // The API is down at the next launch: the card can only come from
      // the list the device kept.
      server.conditions.set(
        const Link(outage: Outage.serverError),
        origins: [Origin.api],
      );
      await app.coldStartAnnouncements();
      expect(app.cardInFirstHomeFrame, isTrue,
          reason: 'the kept list shows in the first frame; ${app.describe()}');
      expect(app.showsText(AnnouncementFixtures.verseTitle), isTrue);
    });

    announcementTest(
        'with ANNOUNCEMENTS_ALWAYS_SHOW a closed announcement shows again at '
        'the next launch; without it, it stays closed', (app) async {
      server.announcements.add(AnnouncementFixtures.verse());
      Future<bool> closeAndRelaunch({required bool alwaysShow}) async {
        await app.coldStartAnnouncements(alwaysShow: alwaysShow);
        await app.waitFor(
            () => app.showsText(AnnouncementFixtures.verseTitle),
            reason: 'the card');
        await app.tapDismiss();
        await app.waitFor(() => RadioApp.announcementCard.evaluate().isEmpty,
            reason: 'the card to close');
        await app.coldStartAnnouncements(alwaysShow: alwaysShow);
        await app.pumpFor(const Duration(seconds: 2));
        return app.showsText(AnnouncementFixtures.verseTitle);
      }

      expect(await closeAndRelaunch(alwaysShow: true), isTrue,
          reason: 'a test build shows it again');
      expect(await closeAndRelaunch(alwaysShow: false), isFalse,
          reason: 'a store build keeps it closed');
    });

    announcementTest(
        'with ANNOUNCEMENTS_ALWAYS_SHOW, hide_after_seconds and '
        'max_impressions do not take the card away', (app) async {
      server.announcements.add({
        ...AnnouncementFixtures.verse(),
        'hide_after_seconds': 2,
        'max_impressions': 1,
      });
      for (final launch in [1, 2]) {
        await app.coldStartAnnouncements(alwaysShow: true);
        await app.waitFor(
            () => app.showsText(AnnouncementFixtures.verseTitle),
            reason: 'the card at launch $launch');
        await app.pumpFor(const Duration(seconds: 4));
        expect(app.showsText(AnnouncementFixtures.verseTitle), isTrue,
            reason: 'still on screen past its 2 s at launch $launch');
      }
      await app.coldStartAnnouncements();
      await app.pumpFor(const Duration(seconds: 2));
      expect(app.showsText(AnnouncementFixtures.verseTitle), isFalse,
          reason: 'a store build stops at its one impression');
    });

    announcementTest(
        'a list slower than the stations still shows in the same launch',
        (app) async {
      server
        ..announcements.add(AnnouncementFixtures.verse())
        ..announcementListDelay = const Duration(seconds: 3);
      await app.coldStartAnnouncements();
      expect(app.cardInFirstHomeFrame, isFalse,
          reason: 'the stations did not wait for a slow list');
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the card to grow in when the list arrives');
    });

    announcementTest(
        'a pull-to-refresh during a slow fetch gets the list as it is after '
        'the pull', (app) async {
      // A healthy API, even when this test is the run's first, slow one.
      server.conditions.restore();
      server.announcementListDelay = const Duration(seconds: 12);
      // Its fetch is still on the way: the launch waited 1.5 s, the list
      // it asked for is empty.
      await app.coldStartAnnouncements();
      server
        ..announcements.add(AnnouncementFixtures.verse())
        ..announcementListDelay = Duration.zero;
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the list as it is after the pull');
    });

    announcementTest(
        'a refresh keeps the announcement on screen where it is', (app) async {
      await showAnnouncements(app);
      await app.swipeAnnouncement();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.concertTitle),
          reason: 'the second announcement');
      server.announcements.insert(0, AnnouncementFixtures.newest());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsPosition('3 din 3'),
          reason: 'the new announcement counted; ${app.describe()}');
      expect(app.showsText(AnnouncementFixtures.concertTitle), isTrue,
          reason: 'the card still shows the announcement it showed');
    });

    announcementTest(
        'max_per_load counts only the announcements meant for this phone',
        (app) async {
      server.announcementSettings = const {
        'rotation_mode': 'fixed',
        'max_per_load': 1,
      };
      server.announcements
        ..add(AnnouncementFixtures.webOnly())
        ..add(AnnouncementFixtures.verse())
        ..add(AnnouncementFixtures.concert());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the first announcement meant for a phone');
      expect(app.showsText(AnnouncementFixtures.webOnlyTitle), isFalse,
          reason: 'a website-only announcement never shows in the app');
      expect(app.showsPosition('1 din 2'), isFalse,
          reason: 'one announcement at most, so no count and no dots');
    });

    announcementTest(
        'the buttons sit under the text and span the card from the icon\'s '
        'left edge, on one row while they can; an old second button is '
        'ignored',
        (app) async {
      final tester = app.tester;
      Rect rectOf(Finder finder) => tester.getRect(finder.hitTestable().first);
      final dismissKey = find.byKey(const ValueKey('announcement-dismiss'));
      Rect buttonOf(String label) => rectOf(
          find.ancestor(of: find.text(label), matching: find.byType(InkWell)));

      // A short label: the button takes the row "Ascunde" leaves.
      server.announcements.add(AnnouncementFixtures.whatsappLive());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.whatsappJoin),
          reason: 'the WhatsApp card');
      final title = rectOf(find.text('Versetul Zilei'));
      var button = buttonOf(AnnouncementFixtures.whatsappJoin);
      var dismiss = rectOf(dismissKey);
      final tile = rectOf(find.byKey(const ValueKey('announcement-icon-tile')));
      final card = tester.getRect(find
          .descendant(
              of: RadioApp.announcementCard, matching: find.byType(DecoratedBox))
          .first);
      final contentRight =
          card.right - StationTileMetrics.contentPadding.right;
      expect(dismiss.right, closeTo(contentRight, 1),
          reason: 'the buttons end on the card\'s right padding');
      expect(title.left, greaterThan(tile.right),
          reason: 'the title beside the icon');
      expect(button.top, greaterThan(title.bottom),
          reason: 'the buttons sit under the text');
      expect(button.left, closeTo(tile.left, 1),
          reason: 'the button starts under the icon: no empty corner');
      expect((dismiss.center.dy - button.center.dy).abs(), lessThan(2),
          reason: '"Ascunde" on the button\'s row');
      expect(dismiss.left - button.right, closeTo(8, 1),
          reason: '"Ascunde" right after the button');

      // A label too long for one line beside "Ascunde": the row wraps.
      await app.tapDismiss();
      server.announcements.add(AnnouncementFixtures.longButtons());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.longPrimary),
          reason: 'the card with long buttons');
      button = buttonOf(AnnouncementFixtures.longPrimary);
      dismiss = rectOf(dismissKey);
      expect(dismiss.top, greaterThanOrEqualTo(button.bottom),
          reason: '"Ascunde" under a button that needs the row');
      for (final line in [button, dismiss]) {
        expect(line.left, closeTo(tile.left, 1),
            reason: 'each line spans the card');
        expect(line.right, closeTo(contentRight, 1),
            reason: 'each line spans the card');
      }
      expect(app.showsText(AnnouncementFixtures.legacySecondary), isFalse,
          reason: 'a second button from an older list is not drawn');
    });

    announcementTest(
        'on the station sheet and the push banner the icon tile spans exactly '
        'the tag and the title, for a one-line and a two-line title',
        (app) async {
      final service = GetIt.instance<AnnouncementsService>();
      final items = [
        Announcement.fromJson(AnnouncementFixtures.sized('small'))!,
        Announcement.fromJson(AnnouncementFixtures.sized('small',
            title: AnnouncementFixtures.twoLineTitle))!,
      ];
      await app.tester.pumpWidget(MaterialApp(
        theme: darkTheme,
        home: Scaffold(
          body: SafeArea(
            // As wide as the iPhone 17 the titles were written for, on any
            // screen.
            child: OverflowBox(
              alignment: Alignment.topLeft,
              minWidth: 402,
              maxWidth: 402,
              child: Column(children: [
                for (final (index, item) in items.indexed)
                  Container(
                    key: ValueKey('header-$index'),
                    padding: const EdgeInsets.all(StationsList.cardSideInset),
                    child: AnnouncementStaticCard(item: item, service: service),
                  ),
              ]),
            ),
          ),
        ),
      ));
      await app.pumpFor(const Duration(seconds: 1));
      final tester = app.tester;
      for (final (index, lines) in [(0, 1), (1, 2)]) {
        Rect inFrame(Finder finder) => tester.getRect(find.descendant(
            of: find.byKey(ValueKey('header-$index')), matching: finder));
        final tile = inFrame(find.byKey(const ValueKey('announcement-icon-tile')));
        // The label, not its pill: what the eye lines up.
        final tag = inFrame(find.text('Comunitate'));
        final title = inFrame(find.byKey(const ValueKey('announcement-title')));
        final where = 'a $lines-line title';
        expect(title.height, closeTo(lines * 16 * 1.3, 2),
            reason: '$where takes $lines line(s)');
        expect(tile.top, closeTo(tag.top, 1), reason: 'icon top, $where');
        expect(tag.left, closeTo(title.left, 1),
            reason: 'the label on the title\'s left edge, $where');
        expect(tile.bottom, closeTo(title.bottom, 1),
            reason: 'icon bottom on the title\'s, $where');
        expect(tile.width, tile.height, reason: 'a square tile, $where');
      }
    });

    announcementTest(
        'the home card reads as a station tile: the logo\'s size and place, '
        'the station title, a hue line, the pager where the listeners are, '
        'its arrows only',
        (app) async {
      server.announcements
        ..add(AnnouncementFixtures.whatsappLive())
        ..add(AnnouncementFixtures.sized('large'));
      await app.pullToRefresh();
      await app.waitFor(() => app.showsPosition('1 din 2'), reason: 'the card');
      await app.pumpFor(const Duration(seconds: 1));
      final tester = app.tester;
      Rect visible(Finder finder) =>
          tester.getRect(finder.hitTestable().first);

      // A station tile under it.
      final row = find.byKey(const ValueKey('station-e2e-alpha'));
      final logo =
          tester.getRect(find.descendant(of: row, matching: find.byType(ClipRRect)).first);
      final stationTitle = find.descendant(of: row, matching: find.text('E2E Alpha'));
      final stationStyle = tester.widget<Text>(stationTitle).style;

      // The cards as drawn, without the space around them.
      final card = tester.getRect(find
          .descendant(
              of: RadioApp.announcementCard, matching: find.byType(DecoratedBox))
          .first);
      final stationCard = tester.getRect(find
          .descendant(of: row, matching: find.byType(DecoratedBox))
          .first);
      final tile = visible(find.byKey(const ValueKey('announcement-icon-tile')));
      final titleFinder = find.byKey(const ValueKey('announcement-title'));
      final title = visible(titleFinder);
      final line = visible(find.byKey(const ValueKey('announcement-category-line')));
      final next = visible(find.byKey(const ValueKey('announcement-next')));
      expect(tile.size, logo.size, reason: 'the icon tile as big as a logo');
      expect(tile.left, closeTo(logo.left, 1),
          reason: 'where a logo sits in its card');
      expect(tile.top - card.top, closeTo(logo.top - stationCard.top, 1),
          reason: 'a logo\'s inset from its card\'s top');
      expect(title.left, closeTo(tester.getRect(stationTitle).left, 1),
          reason: 'the title where a station\'s is');
      final style = tester.widget<Text>(titleFinder.hitTestable().first).style;
      expect(style?.fontSize, stationStyle?.fontSize,
          reason: 'the station-title size');
      expect(style?.fontWeight, stationStyle?.fontWeight,
          reason: 'the station-title weight');
      expect(line.top, greaterThanOrEqualTo(title.bottom),
          reason: 'the category line under the title');
      // The pager mirrors the station tile's heart: as far from the top-right
      // corner as the heart is from the bottom-right one.
      final heart = tester.getRect(find
          .descendant(of: row, matching: find.byIcon(Icons.favorite_border_sharp))
          .first);
      final circle = visible(find.descendant(
          of: find.byKey(const ValueKey('announcement-next')),
          matching: find.byKey(const ValueKey('announcement-pager-circle'))));
      expect(card.right - circle.right,
          closeTo(stationCard.right - heart.right, 1),
          reason: 'the pager as far from the right as the heart');
      expect(circle.top - card.top,
          closeTo(stationCard.bottom - heart.bottom, 1),
          reason: 'the pager as far from the top as the heart from the bottom');
      expect(next.right, lessThanOrEqualTo(card.right));
      // Only the arrows in the corner, no "i din n": the title gets the room.
      expect(
          find.descendant(
              of: RadioApp.announcementCard,
              matching: find.textContaining(RegExp(r'^\d+ din \d+$'))),
          findsNothing,
          reason: 'no "i din n" on the card');
      final previous =
          visible(find.byKey(const ValueKey('announcement-previous')));
      expect(next.left, closeTo(previous.right, 1),
          reason: 'the arrows side by side, nothing between them');
      final titleRoom = (tester.renderObject(titleFinder.hitTestable().first)
              as RenderBox)
          .constraints
          .maxWidth;
      expect(title.left + titleRoom, closeTo(previous.left, 1),
          reason: 'the title runs up to the arrows');

      // The admin's size does not change the home card's tile.
      await app.tapKey('announcement-next');
      await app.waitFor(() => app.showsPosition('2 din 2'), reason: 'the second');
      await app.pumpFor(const Duration(milliseconds: 600));
      expect(visible(find.byKey(const ValueKey('announcement-icon-tile'))).size,
          logo.size,
          reason: 'a large icon still takes the logo size on the home card');
    });

    announcementTest(
        'the button takes the admin\'s color or the app\'s, and the category '
        'line the announcement\'s hue, or stays grey', (app) async {
      server.announcements
        ..add(AnnouncementFixtures.verse())
        ..add(AnnouncementFixtures.uncolored());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the card');
      Color fillOf(String text, Type type) {
        final box = find
            .ancestor(
                of: find.text(text).hitTestable(),
                matching: find.byType(type))
            .first;
        final widget = app.tester.widget(box);
        return switch (widget) {
          Material(:final color?) => color,
          Container(decoration: BoxDecoration(:final color?)) => color,
          _ => throw StateError('no fill on $text'),
        };
      }

      Color textColorOf(String text) => app.tester
          .widget<Text>(find.text(text).hitTestable().first)
          .style!
          .color!;
      final theme =
          Theme.of(app.tester.element(find.text('Community').first));

      expect(fillOf('Join the group', Material), const Color(0xFF0F6E63),
          reason: "the admin's button color stays");
      expect(textColorOf('Community'),
          theme.announcementCategoryLine(
              Announcement.fromJson(AnnouncementFixtures.verse())!),
          reason: "the category line in the announcement's hue");

      await app.tapKey('announcement-next');
      await app.waitFor(
          () => app.showsText(AnnouncementFixtures.uncoloredTitle),
          reason: 'the card without colors');
      expect(fillOf(AnnouncementFixtures.uncoloredButton, Material),
          AppColors.announcementButton,
          reason: "the button takes the app's pink");
      expect(textColorOf(AnnouncementFixtures.uncoloredCategory),
          theme.announcementColors.muted,
          reason: 'without a color the category line stays grey');
    });

    announcementTest(
        'a push while the app is open slides down a card as tall as its '
        'content', (app) async {
      // What a push in the foreground does once it has the announcement
      // (FCM can't reach the simulator).
      AnnouncementBanner.show(
        Announcement.fromJson(AnnouncementFixtures.concert())!,
        GetIt.instance<AnnouncementsService>(),
      );
      final card = find.byKey(const ValueKey(
          'announcement-static-${AnnouncementFixtures.concertSlug}'));
      await app.waitFor(() => card.hitTestable().evaluate().isNotEmpty,
          reason: 'the banner to slide down');
      final height = app.tester.getSize(card).height;
      expect(height, lessThan(260),
          reason: 'the banner is as tall as its card, not the screen');
      await app.tapDismiss();
      await app.waitFor(() => card.evaluate().isEmpty,
          reason: 'the banner to go after "Ascunde"');
    });

    announcementTest(
        'a title-only announcement leaves no gap for its empty body in the '
        'card, the push banner and the page', (app) async {
      server.announcements.add(AnnouncementFixtures.titleOnly());
      await app.pullToRefresh();
      await app.waitFor(
          () => app.showsText(AnnouncementFixtures.titleOnlyTitle),
          reason: 'the card');
      final card = RadioApp.announcementCard;
      expect(
          find.descendant(of: card, matching: find.byType(InlineMarkdownText)),
          findsNothing,
          reason: 'no body line');
      // The card also lays out an invisible copy of the slide; the last
      // one is the slide on screen.
      final titleBottom = app.tester
          .getBottomLeft(find.text(AnnouncementFixtures.titleOnlyTitle).last)
          .dy;
      final buttonTop = app.tester
          .getTopLeft(find.text(AnnouncementFixtures.titleOnlyButton).last)
          .dy;
      final tileBottom = app.tester
          .getRect(find
              .byKey(const ValueKey('announcement-icon-tile'))
              .hitTestable()
              .first)
          .bottom;
      expect(buttonTop - max(titleBottom, tileBottom), lessThan(24),
          reason: 'the button sits right under the logo and title');

      // The push banner shows the same slide.
      AnnouncementBanner.show(
        Announcement.fromJson(AnnouncementFixtures.titleOnly())!,
        GetIt.instance<AnnouncementsService>(),
      );
      final banner = find.byKey(const ValueKey(
          'announcement-static-${AnnouncementFixtures.titleOnlySlug}'));
      await app.waitFor(() => banner.hitTestable().evaluate().isNotEmpty,
          reason: 'the banner to slide down');
      expect(
          find.descendant(
              of: banner, matching: find.byType(InlineMarkdownText)),
          findsNothing,
          reason: 'no body line in the banner');
      AnnouncementBanner.hide();
      await app.pumpFor(const Duration(milliseconds: 500));

      await app.tapText(AnnouncementFixtures.titleOnlyButton);
      await app.waitFor(
          () => find.byKey(const ValueKey('markdown')).evaluate().isNotEmpty,
          reason: 'the page, loaded');
      expect(find.byType(MarkdownBody), findsNothing,
          reason: 'the page has no empty text block');
    });

    announcementTest(
        'button labels keep to one line, both buttons are one height and the '
        'row spans the card; "Ascunde" goes under the main button, both full '
        'width, only when they don\'t fit side by side', (app) async {
      final items = [
        Announcement.fromJson(AnnouncementFixtures.whatsappVerse())!,
        Announcement.fromJson(AnnouncementFixtures.longButtons())!,
        Announcement.fromJson(AnnouncementFixtures.poll())!,
        Announcement.fromJson(AnnouncementFixtures.whatsappLive())!,
        // A text-link button keeps its own width.
        Announcement.fromJson(AnnouncementFixtures.concert())!,
      ];
      final service = GetIt.instance<AnnouncementsService>();
      final tester = app.tester;
      for (final width in [375.0, 402.0]) {
        for (final scale in [1.0, 1.3]) {
          await tester.pumpWidget(MaterialApp(
            theme: darkTheme,
            home: Scaffold(
              body: Builder(
                builder: (context) => MediaQuery(
                  data: MediaQuery.of(context)
                      .copyWith(textScaler: TextScaler.linear(scale)),
                  child: SingleChildScrollView(
                    child: Column(children: [
                      for (final (index, item) in items.indexed)
                        SizedBox(
                          key: ValueKey('buttons-$index'),
                          width: width,
                          child: AnnouncementCard(
                            items: [item],
                            service: service,
                            margin: const EdgeInsets.all(
                                StationsList.cardSideInset),
                          ),
                        ),
                    ]),
                  ),
                ),
              ),
            ),
          ));
          await app.pumpFor(const Duration(milliseconds: 600));
          for (final (index, item) in items.indexed) {
            final frame = find.byKey(ValueKey('buttons-$index'));
            Finder inFrame(Finder finder) =>
                find.descendant(of: frame, matching: finder).last;
            final where = '"${item.button!.label}", ${width.toInt()} px, '
                'text ${scale}x';
            final labelFinder = inFrame(find.text(item.button!.label));
            final label = tester.renderObject<RenderParagraph>(labelFinder);
            final lines = label
                .getBoxesForSelection(TextSelection(
                    baseOffset: 0, extentOffset: item.button!.label.length))
                .map((box) => box.top.round())
                .toSet();
            expect(lines.length, 1, reason: 'one line, $where');
            final button = tester.getRect(find
                .ancestor(of: labelFinder, matching: find.byType(InkWell))
                .first);
            final dismiss = tester.getRect(
                inFrame(find.byKey(const ValueKey('announcement-dismiss'))));
            expect(button.height, closeTo(dismiss.height, 0.5),
                reason: 'one height, $where');
            // The card's content ends at its right padding, as a station
            // tile's heart does.
            final contentLeft = tester.getRect(frame).left +
                StationsList.cardSideInset +
                StationTileMetrics.contentPadding.left;
            final contentRight = tester.getRect(frame).right -
                StationsList.cardSideInset -
                StationTileMetrics.contentPadding.right;
            expect(dismiss.right, closeTo(contentRight, 1),
                reason: '"Ascunde" on the right, $where');
            expect(button.left, closeTo(contentLeft, 1),
                reason: 'the main button from the left edge, $where');
            final isLink =
                item.button!.style == AnnouncementButtonStyle.text;
            final sideBySide = (button.center.dy - dismiss.center.dy).abs() < 1;
            if (sideBySide) {
              if (isLink) {
                expect(button.right, lessThanOrEqualTo(dismiss.left - 8),
                    reason: 'a link before "Ascunde", $where');
              } else {
                expect(dismiss.left - button.right, closeTo(8, 1),
                    reason: 'the main button fills up to "Ascunde", $where');
              }
            } else {
              expect(dismiss.top, greaterThanOrEqualTo(button.bottom),
                  reason: '"Ascunde" under the main button, $where');
              for (final line in [button, dismiss]) {
                expect(line.left, closeTo(contentLeft, 1),
                    reason: 'each line full width, $where');
                expect(line.right, closeTo(contentRight, 1),
                    reason: 'each line full width, $where');
              }
            }
            expect(label.didExceedMaxLines, isFalse,
                reason: 'the whole label shows, $where');
          }
          expect(tester.takeException(), isNull, reason: 'no overflow');
        }
      }
    });

    announcementTest(
        'the home card title wraps to three lines clear of the arrows, then '
        'ends in "…"', (app) async {
      final long = Announcement.fromJson(
          AnnouncementFixtures.sized('small',
              title: AnnouncementFixtures.twoLineTitle))!;
      final tooLong =
          Announcement.fromJson(AnnouncementFixtures.tooLongTitle())!;
      final other = Announcement.fromJson(AnnouncementFixtures.whatsappLive())!;
      final service = GetIt.instance<AnnouncementsService>();
      final tester = app.tester;
      for (final width in [375.0, 402.0]) {
        for (final scale in [1.0, 1.3]) {
          await tester.pumpWidget(MaterialApp(
            theme: darkTheme,
            home: Scaffold(
              body: Builder(
                builder: (context) => MediaQuery(
                  data: MediaQuery.of(context).copyWith(
                      size: Size(width, MediaQuery.of(context).size.height),
                      textScaler: TextScaler.linear(scale)),
                  child: SingleChildScrollView(
                    child: Column(children: [
                      for (final (index, item) in [long, tooLong].indexed)
                        SizedBox(
                          key: ValueKey('title-$index'),
                          width: width,
                          // Two announcements, so the arrows show.
                          child: AnnouncementCard(
                            items: [item, other],
                            service: service,
                            margin: const EdgeInsets.all(
                                StationsList.cardSideInset),
                          ),
                        ),
                    ]),
                  ),
                ),
              ),
            ),
          ));
          await app.pumpFor(const Duration(milliseconds: 600));
          for (final (index, item) in [long, tooLong].indexed) {
            final frame = find.byKey(ValueKey('title-$index'));
            Finder inFrame(String key) => find
                .descendant(of: frame, matching: find.byKey(ValueKey(key)))
                .hitTestable()
                .first;
            final where = '"${item.title}", ${width.toInt()} px, '
                'text ${scale}x';
            final titleFinder = inFrame('announcement-title');
            final title = tester.renderObject<RenderParagraph>(titleFinder);
            final lines = title
                .getBoxesForSelection(TextSelection(
                    baseOffset: 0, extentOffset: item.title.length))
                .map((box) => box.top.round())
                .toSet()
                .length;
            final previous = tester.getRect(inFrame('announcement-previous'));
            expect(
                tester.getTopLeft(titleFinder).dx + title.constraints.maxWidth,
                lessThanOrEqualTo(previous.left + 1),
                reason: 'every title line clear of the arrows, $where');
            expect(lines, lessThanOrEqualTo(StationTileMetrics.titleLines),
                reason: 'three lines at most, $where');
            if (item == tooLong || title.didExceedMaxLines) {
              expect(title.didExceedMaxLines, isTrue,
                  reason: 'cut short, $where');
              expect(lines, StationTileMetrics.titleLines,
                  reason: 'cut only after the third line, $where');
              expect(title.overflow, TextOverflow.ellipsis,
                  reason: 'ends in "…", $where');
            }
            if (item == long && scale == 1.0) {
              expect(title.didExceedMaxLines, isFalse,
                  reason: 'the whole title in three lines, $where');
            }
          }
          expect(tester.takeException(), isNull, reason: 'no overflow');
        }
      }
    });

    announcementTest(
        "the icon tile and the tag take the announcement's hue, readable at "
        'AA in both themes', (app) async {
      // Hue: the button's color, else the category's, else none.
      final themes = {'light': lightTheme, 'dark': darkTheme};
      for (final MapEntry(key: name, value: theme) in themes.entries) {
        for (final hex in ['#0D8040', '#075E54', '#0F6E63', '#F5C518']) {
          for (final onButton in [true, false]) {
            final item = Announcement.fromJson(
                AnnouncementFixtures.hued(hex, onButton: onButton))!;
            final where = '$hex on the ${onButton ? 'button' : 'category'}, '
                '$name theme';
            expect(theme.announcementHue(item), parseHexColor(hex),
                reason: 'the hue, $where');
            for (final surface in [
              theme.announcementCardSurface,
              theme.scaffoldBackgroundColor,
            ]) {
              final fill = Color.alphaBlend(
                  theme.announcementTagColor(item), surface);
              expect(
                  contrastRatio(
                      theme.announcementTagLabel(item, surface: surface),
                      fill),
                  greaterThanOrEqualTo(minTextContrast),
                  reason: 'the tag reads at AA, $where');
            }
          }
        }
        for (final hex in ['#0D8040', '#075E54', '#0F6E63', '#F5C518']) {
          final item = Announcement.fromJson(AnnouncementFixtures.hued(hex))!;
          expect(
              contrastRatio(theme.announcementCategoryLine(item),
                  theme.announcementCardSurface),
              greaterThanOrEqualTo(minTextContrast),
              reason: 'the home card\'s category line reads at AA, $hex, '
                  '$name theme');
        }
        final plain =
            Announcement.fromJson(AnnouncementFixtures.hued(null))!;
        expect(theme.announcementHue(plain), isNull);
        expect(theme.announcementIconTileColor(plain),
            theme.announcementColors.control,
            reason: 'no hue: the tile stays neutral, $name theme');
        expect(theme.announcementTagLabel(plain),
            theme.announcementColors.muted);
      }

      // The live WhatsApp card, in both themes at 390 px.
      final item = Announcement.fromJson(AnnouncementFixtures.whatsappLive())!;
      final service = GetIt.instance<AnnouncementsService>();
      await app.tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SafeArea(
            child: Column(children: [
              for (final MapEntry(key: name, value: theme) in themes.entries)
                Theme(
                  data: theme,
                  child: Container(
                    key: ValueKey('hue-$name'),
                    width: 390,
                    color: theme.scaffoldBackgroundColor,
                    padding: const EdgeInsets.all(StationsList.cardSideInset),
                    child: AnnouncementStaticCard(item: item, service: service),
                  ),
                ),
            ]),
          ),
        ),
      ));
      await app.pumpFor(const Duration(seconds: 1));
      for (final MapEntry(key: name, value: theme) in themes.entries) {
        final frame = find.byKey(ValueKey('hue-$name'));
        Finder inFrame(Finder finder) =>
            find.descendant(of: frame, matching: finder);
        final glyph = app.tester.widget<Icon>(inFrame(find.descendant(
            of: find.byKey(const ValueKey('announcement-icon-tile')),
            matching: find.byType(Icon))));
        expect(glyph.color, theme.announcementGlyphColor(item),
            reason: 'the glyph in the hue, $name theme');
        final label =
            app.tester.widget<Text>(inFrame(find.text(AnnouncementFixtures.whatsappJoin)));
        expect(label.style?.color, const Color(0xFFFFFFFF),
            reason: 'the admin\'s white button text, $name theme');
        expect(
            inFrame(find.byIcon(announcementIcons['whatsapp']!)),
            findsNWidgets(2),
            reason: 'the WhatsApp icon on the tile and the button, $name');
      }
    });

    announcementTest(
        "a page's YouTube links are thumbnails that open YouTube, pausing "
        'the radio', (app) async {
      server.announcements.add(AnnouncementFixtures.videos());
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.videoTitle),
          reason: 'the card');
      await app.tapText(AnnouncementFixtures.videoTitle);
      await app.waitFor(
          () => app.showsText(AnnouncementFixtures.videoPageTitle),
          reason: 'the page');
      final facades = find.byKey(const ValueKey('youtube-facade'));
      await app.waitFor(() => facades.evaluate().length == 3,
          reason: 'a video, a Short and a playlist; the link in a sentence '
              'stays a link');
      expect(
          find.textContaining('on YouTube', findRichText: true),
          findsOneWidget,
          reason: 'the link inside a sentence stays text');

      final launcher = RecordingLauncher();
      final systemLauncher = UrlLauncherPlatform.instance;
      UrlLauncherPlatform.instance = launcher;
      try {
        await app.tester.tap(facades.first);
        await app.waitFor(() => launcher.launches.isNotEmpty,
            reason: 'the tap to open YouTube');
        expect(launcher.launches.single.url,
            'https://www.youtube.com/watch?v=${AnnouncementFixtures.videoId}'
            '&t=65s',
            reason: 'the canonical link, from the start time');
        expect(launcher.launches.single.mode,
            PreferredLaunchMode.externalNonBrowserApplication,
            reason: 'in the YouTube app');
        await app.waitFor(() => !app.audio.playbackState.value.playing,
            reason: 'the radio to pause for the video');
        await app.waitFor(
            () => server.announcementEvents.any((e) =>
                e['slug'] == AnnouncementFixtures.videoSlug &&
                e['type'] == 'video_play' &&
                e['provider'] == 'youtube' &&
                e['kind'] == 'video'),
            reason: 'video_play to reach the backend',
            timeout: const Duration(seconds: 15));

        // Back from YouTube, the radio stays paused, even where a return
        // starts the last station (iOS, with auto-start on).
        await app.turnOnAutoStart();
        await app.leaveAndReturn();
        await app.pumpFor(const Duration(seconds: 10));
        expect(app.audio.playbackState.value.playing, isFalse,
            reason: 'no autoplay after the video; ${app.describe()}');

        // Without the YouTube app, the browser opens it.
        launcher
          ..launches.clear()
          ..appInstalled = false;
        await app.tester.ensureVisible(facades.at(1));
        await app.tester.tap(facades.at(1));
        await app.waitFor(() => launcher.launches.length == 2,
            reason: 'the app, then the browser');
        expect(
            launcher.launches.map((launch) => launch.mode),
            [
              PreferredLaunchMode.externalNonBrowserApplication,
              PreferredLaunchMode.externalApplication,
            ],
            reason: 'the browser when no app takes it');
        expect(launcher.launches.last.url,
            'https://www.youtube.com/shorts/${AnnouncementFixtures.shortId}');
      } finally {
        UrlLauncherPlatform.instance = systemLauncher;
      }
      expect(find.byType(WebViewWidget), findsNothing,
          reason: 'no player inside the app');
    });

    announcementTest('a launch forgets what the removed "later" button kept',
        (app) async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('announcements_snoozed',
          '{"${AnnouncementFixtures.verseSlug}":"2099-01-01T00:00:00Z"}');
      await app.coldStartAnnouncements();
      await app.waitFor(() => !prefs.containsKey('announcements_snoozed'),
          reason: 'the old snoozes to be removed');
    });

    /// Expects the Share-A-Thon [description] whole, within the card's
    /// lines, its second paragraph starting a line of its own.
    Future<void> expectWholeDescription(RadioApp app, Finder description,
        {required String where}) async {
      final paragraph = app.tester.renderObject<RenderParagraph>(
          find.descendant(of: description, matching: find.byType(RichText)));
      const first = AnnouncementFixtures.shareAThonFirstLine;
      const second = AnnouncementFixtures.shareAThonSecondLine;
      expect(paragraph.text.toPlainText(), '$first\n$second',
          reason: 'the two paragraphs, a line break between them, $where');
      expect(paragraph.didExceedMaxLines, isFalse,
          reason: 'the whole description shows, "Donează" included, $where');
      final boxes = paragraph.getBoxesForSelection(TextSelection(
          baseOffset: 0, extentOffset: first.length + 1 + second.length));
      final lines = boxes.map((box) => box.top.round()).toSet().length;
      expect(lines, lessThanOrEqualTo(StationTileMetrics.descriptionLines),
          reason: 'at most ${StationTileMetrics.descriptionLines} lines, '
              '$where');
      final firstEnd = paragraph
          .getBoxesForSelection(TextSelection(
              baseOffset: first.length - 1, extentOffset: first.length))
          .single;
      final secondStart = paragraph
          .getBoxesForSelection(TextSelection(
              baseOffset: first.length + 1, extentOffset: first.length + 2))
          .single;
      expect(secondStart.top, greaterThan(firstEnd.top),
          reason: 'the second paragraph below the first, $where');
      expect(secondStart.left, closeTo(0, 0.5),
          reason: 'the second paragraph at the start of a line, $where');
      debugPrint('Share-A-Thon description, $where: $lines lines');
    }

    /// Taps "Donează" in [description] and expects the donation page to
    /// open in the browser.
    Future<void> expectLinkOpens(RadioApp app, Finder description) async {
      final launcher = RecordingLauncher();
      final systemLauncher = UrlLauncherPlatform.instance;
      UrlLauncherPlatform.instance = launcher;
      try {
        await tapText(app, description, AnnouncementFixtures.shareAThonLink);
        await app.waitFor(() => launcher.launches.isNotEmpty,
            reason: 'the link to open');
        expect(launcher.launches.single.url,
            AnnouncementFixtures.shareAThonDonateUrl,
            reason: 'the link, not the card\'s button');
        expect(launcher.launches.single.mode,
            PreferredLaunchMode.externalApplication);
      } finally {
        UrlLauncherPlatform.instance = systemLauncher;
      }
    }

    /// Serves [items] in this order with [settings] and starts the app
    /// again, so the card starts afresh with [shown] of them (all unless
    /// given).
    Future<void> launchWith(
      RadioApp app,
      List<Map<String, Object?>> items, {
      Map<String, Object?> settings = const {},
      int? shown,
    }) async {
      // A healthy API, even when this test is the run's first, slow one.
      server.conditions.restore();
      server
        ..announcements.clear()
        ..announcements.addAll(items)
        ..announcementSettings = {
          ...FakeRadioServer.defaultAnnouncementSettings,
          ...settings,
        };
      await app.coldStartAnnouncements();
      final count = shown ?? items.length;
      // One announcement alone has no count.
      await app.waitFor(
          () => count > 1
              ? app.showsPosition('1 din $count')
              : RadioApp.announcementCard.hitTestable().evaluate().isNotEmpty,
          reason: 'the card; ${app.describe()}');
      // A list that comes after the first frame grows the card in: let it
      // settle before tapping its buttons.
      await app.pumpFor(const Duration(seconds: 1));
    }

    /// Lets [duration] pass and expects the card still on [counter].
    Future<void> expectStays(RadioApp app, String counter,
        {Duration duration = const Duration(seconds: 7),
        required String reason}) async {
      await app.pumpFor(duration);
      expect(app.showsPosition(counter), isTrue,
          reason: '$reason; ${app.describe()}');
    }

    Future<void> waitForCounter(RadioApp app, String counter,
            {required String reason}) =>
        app.waitFor(() => app.showsPosition(counter),
            reason: reason, timeout: const Duration(seconds: 8));

    announcementTest("the card keeps the server's order", (app) async {
      // Positions 1, 2, 0: the list order wins over any number.
      await launchWith(app, [
        AnnouncementFixtures.concert(),
        AnnouncementFixtures.newest(),
        AnnouncementFixtures.verse(),
      ]);
      expect(app.showsText(AnnouncementFixtures.concertTitle), isTrue,
          reason: 'the first in the list first; card: ${app.describeCard()}');
      await app.tapKey('announcement-next');
      await app.waitFor(() => app.showsPosition('2 din 3'), reason: 'the second');
      expect(app.showsText(AnnouncementFixtures.newestTitle), isTrue);
      await app.tapKey('announcement-next');
      await app.waitFor(() => app.showsPosition('3 din 3'), reason: 'the third');
      expect(app.showsText(AnnouncementFixtures.verseTitle), isTrue);
    });

    announcementTest(
        'rotate starts each launch one further, in the server\'s order, and '
        'paging stops at the ends of that turn', (app) async {
      final items = [
        AnnouncementFixtures.verse(),
        AnnouncementFixtures.concert(),
        AnnouncementFixtures.newest(),
      ];
      const rotate = {'rotation_mode': 'rotate'};
      await launchWith(app, items, settings: rotate);
      expect(app.showsText(AnnouncementFixtures.verseTitle), isTrue,
          reason: 'the first launch starts at the first');

      await launchWith(app, items, settings: rotate);
      expect(app.showsText(AnnouncementFixtures.concertTitle), isTrue,
          reason: 'the next launch starts at the second');
      // The turn: concert, newest, verse; the ends stop.
      await app.tapKey('announcement-previous');
      expect(app.showsPosition('1 din 3'), isTrue,
          reason: 'nothing before the start of the turn');
      for (final (counter, title) in [
        ('2 din 3', AnnouncementFixtures.newestTitle),
        ('3 din 3', AnnouncementFixtures.verseTitle),
      ]) {
        await app.tapKey('announcement-next');
        await app.waitFor(
            () => app.showsPosition(counter) && app.showsText(title),
            reason: '$counter, "$title"');
      }
      await app.tapKey('announcement-next');
      expect(app.showsPosition('3 din 3'), isTrue,
          reason: 'nothing after the end of the turn');
    });

    announcementTest(
        'autoplay moves on by itself to the last one, at the tallest '
        "one's height all along", (app) async {
      await launchWith(app, [
        AnnouncementFixtures.titleOnly(),
        AnnouncementFixtures.concert(),
        AnnouncementFixtures.verse(),
      ], settings: {'autoplay_seconds': 3});
      final card = RadioApp.announcementCard;
      final height = app.tester.getSize(card).height;
      await waitForCounter(app, '2 din 3', reason: 'the first move');
      await app.pumpFor(const Duration(seconds: 1));
      expect(app.tester.getSize(card).height, height,
          reason: 'the title-only card was already as tall as the tallest');
      await waitForCounter(app, '3 din 3', reason: 'the second move');
      await expectStays(app, '3 din 3',
          reason: 'it stops at the last one, without going round');
      expect(app.tester.getSize(card).height, height);
    });

    announcementTest(
        'autoplay waits while the card is touched, half off the screen or '
        'the app is in the background', (app) async {
      await launchWith(app, [
        AnnouncementFixtures.verse(),
        AnnouncementFixtures.concert(),
        AnnouncementFixtures.newest(),
        AnnouncementFixtures.titleOnly(),
      ], settings: {'autoplay_seconds': 3});

      final touch = await app.tester
          .startGesture(app.tester.getCenter(RadioApp.announcementCard));
      await expectStays(app, '1 din 4', reason: 'a finger on the card');
      await touch.cancel();
      await waitForCounter(app, '2 din 4', reason: 'on once let go');

      await app.scrollStations();
      await app.pumpFor(const Duration(seconds: 7));
      await app.scrollStations(up: true);
      // Read once back: off the screen the counter can't be found.
      expect(app.showsPosition('2 din 4'), isTrue,
          reason: 'no move while the card was scrolled away');
      await waitForCounter(app, '3 din 4', reason: 'on once back');

      app.goToBackground();
      await expectStays(app, '3 din 4', reason: 'the app in the background');
      await app.comeBack();
      await waitForCounter(app, '4 din 4', reason: 'on once back');
    });

    announcementTest(
        'autoplay stops for good after a swipe, an arrow or "Ascunde", and '
        'is off with reduced motion', (app) async {
      final items = [
        AnnouncementFixtures.verse(),
        AnnouncementFixtures.concert(),
        AnnouncementFixtures.newest(),
      ];
      const autoplay = {'autoplay_seconds': 3};

      await launchWith(app, items, settings: autoplay);
      await app.swipeAnnouncement();
      await expectStays(app, '2 din 3', reason: 'stopped by a swipe');

      await launchWith(app, items, settings: autoplay);
      await app.tapKey('announcement-next');
      await expectStays(app, '2 din 3', reason: 'stopped by an arrow');

      final dispatcher = app.tester.platformDispatcher;
      dispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      try {
        await launchWith(app, items, settings: autoplay);
        await expectStays(app, '1 din 3', reason: 'off with reduced motion');
      } finally {
        dispatcher.clearAccessibilityFeaturesTestValue();
      }

      // Last: the closed announcement stays closed.
      await launchWith(app, items, settings: autoplay);
      await app.tapDismiss();
      await app.waitFor(() => app.showsPosition('1 din 2'), reason: 'closed');
      await expectStays(app, '1 din 2', reason: 'stopped by "Ascunde"');
    });

    announcementTest(
        'the card swipes and steps with its buttons, and a tap opens its page',
        (app) async {
      await showAnnouncements(app);
      expect(app.showsPosition('1 din 2'), isTrue, reason: app.describe());

      await app.swipeAnnouncement();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.concertTitle),
          reason: 'the second announcement after a swipe');
      expect(app.showsPosition('2 din 2'), isTrue);

      // The buttons stop at the ends: the way out is disabled there, and a
      // tap on it changes nothing.
      final semantics = app.tester.ensureSemantics();
      void expectEnabled(String button, bool enabled) => expect(
            app.tester.getSemantics(find.byKey(ValueKey(button))),
            isSemantics(hasEnabledState: true, isEnabled: enabled),
            reason: '$button is ${enabled ? 'enabled' : 'disabled'}',
          );
      Future<void> step(String button, String counter, String title) async {
        await app.tapKey(button);
        await app.waitFor(
            () => app.showsPosition(counter) && app.showsText(title),
            reason: '$button to show $counter, "$title"');
      }

      expectEnabled('announcement-next', false);
      expectEnabled('announcement-previous', true);
      await step('announcement-next', '2 din 2',
          AnnouncementFixtures.concertTitle);
      await step('announcement-previous', '1 din 2',
          AnnouncementFixtures.verseTitle);
      expectEnabled('announcement-previous', false);
      expectEnabled('announcement-next', true);
      await step('announcement-previous', '1 din 2',
          AnnouncementFixtures.verseTitle);
      await step('announcement-next', '2 din 2',
          AnnouncementFixtures.concertTitle);
      semantics.dispose();

      await app.tapText(AnnouncementFixtures.concertTitle);
      await app.waitFor(() => app.showsText(AnnouncementFixtures.pageTitle),
          reason: 'the announcement page to open');
      await app.waitFor(() => app.showsText(AnnouncementFixtures.pageHeading),
          reason: 'the page markdown, from the single announcement');
      await app.waitFor(
          () => server.announcementEvents.any((e) =>
              e['slug'] == AnnouncementFixtures.concertSlug &&
              e['type'] == 'clicked' &&
              e['target'] == 'card'),
          reason: 'the card tap to reach the backend');

      await app.tapTooltip('Înapoi');
      await app.waitFor(() => app.showsText(AnnouncementFixtures.concertTitle),
          reason: 'Home with the card, after the page');
    });

    announcementTest('"Ascunde" hides an announcement for good', (app) async {
      await showAnnouncements(app);

      await app.tapDismiss();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.concertTitle),
          reason: 'the next announcement after hiding the first');
      await app.tapDismiss();
      await app.waitFor(() => RadioApp.announcementCard.evaluate().isEmpty,
          reason: 'the card to go once both are hidden');

      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      expect(
        prefs.getStringList('announcements_dismissed'),
        containsAll(
            [AnnouncementFixtures.verseSlug, AnnouncementFixtures.concertSlug]),
        reason: 'the hidden slugs are saved on the device',
      );

      await app.coldStartAnnouncements();
      await app.pumpFor(const Duration(seconds: 3));
      expect(RadioApp.announcementCard, findsNothing,
          reason: 'a hidden announcement does not come back');
      await app.waitFor(
          () =>
              server.announcementEvents
                  .where((e) => e['type'] == 'dismissed')
                  .length ==
              2,
          reason: 'both dismissals to reach the backend',
          timeout: const Duration(seconds: 15));
    });

    test("the hide rules agree with the backend's shared cases", (_) async {
      final cases = jsonDecode(announcementHideRuleCases) as Map;
      for (final entry in cases['hide_cases'] as List) {
        final rules = AnnouncementHideRules.fromJson(entry['rules'] as Map);
        final reason =
            rules.hideReason(_countsFromCase(entry['counts'] as Map));
        expect(reason?.apiName, entry['hidden_by'], reason: entry['name']);
      }
      for (final entry in cases['show_again_cases'] as List) {
        final rules = AnnouncementHideRules.fromJson(entry['rules'] as Map);
        final counts = _countsFromCase(entry['counts'] as Map);
        expect(rules.comesBack(counts), entry['comes_back'],
            reason: '${entry['name']}: comes back');
        expect(rules.isHidden(counts), entry['hidden'],
            reason: '${entry['name']}: hidden');
        expect(rules.onVisit(counts).shown, !(entry['hidden'] as bool),
            reason: '${entry['name']}: shown at the visit');
      }
      // Visit steps: 'v' shows (one impression), '-' hidden, 'v+c' shows
      // and its button is clicked, 'x' shows and is closed. Event steps:
      // 'o' another announcement seen, 'p' a playback of any station,
      // 'p:<slug>' of that station.
      for (final entry in cases['timelines'] as List) {
        final rules = AnnouncementHideRules.fromJson(entry['rules'] as Map);
        var counts = const AnnouncementCounts();
        final steps = (entry['steps'] as List).cast<String>();
        for (final (i, step) in steps.indexed) {
          if (step == 'o') {
            counts = rules.onOtherImpression(counts);
            continue;
          }
          if (step == 'p' || step.startsWith('p:')) {
            final station = step == 'p' ? 'any-station' : step.substring(2);
            counts = rules.onPlayback(counts, station);
            continue;
          }
          final visit = rules.onVisit(counts);
          counts = visit.counts;
          expect(visit.shown, step != '-',
              reason: '${entry['name']}: step ${i + 1} ("$step")');
          if (!visit.shown) continue;
          counts = rules.onImpression(counts);
          if (step == 'v+c') counts = rules.onClick(counts);
          if (step == 'x') counts = counts.copyWith(dismissed: true);
        }
      }
      for (final entry in cases['click_cases'] as List) {
        final rules = AnnouncementHideRules.fromJson({
          'hide_after_clicks': 1,
          'hide_click_target': entry['hide_click_target']
        });
        final event = entry['event'] as Map;
        expect(
            rules.countsClick(
                event['type'] as String, event['target'] as String?),
            entry['counts'],
            reason: entry['name']);
      }
    });

    /// Taps the verse's button, which would open WhatsApp, with the
    /// system's link opener stood in for, so the app stays on screen.
    Future<void> clickVerseButton(RadioApp app) async {
      final launcher = RecordingLauncher();
      final systemLauncher = UrlLauncherPlatform.instance;
      UrlLauncherPlatform.instance = launcher;
      try {
        await app.tapText('Join the group');
        await app.waitFor(() => launcher.launches.isNotEmpty,
            reason: 'the button to open its link');
      } finally {
        UrlLauncherPlatform.instance = systemLauncher;
      }
    }

    /// Starts the announcements anew, as the next launch, and gives the
    /// card on screen the time to count as seen.
    Future<bool> verseShowsAtNextLaunch(RadioApp app) async {
      await app.coldStartAnnouncements();
      await app.pumpFor(const Duration(seconds: 3));
      return app.showsText(AnnouncementFixtures.verseTitle);
    }

    announcementTest(
        'hide_after_clicks: 1 takes the card away at the click, for good',
        (app) async {
      server.announcements.add({
        ...AnnouncementFixtures.verse(),
        'hide_after_clicks': 1,
        'hide_click_target': 'main',
      });
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the card before the click');
      await clickVerseButton(app);
      await app.waitFor(() => RadioApp.announcementCard.evaluate().isEmpty,
          reason: 'the card to go at the click; ${app.describeCard()}');
      await app.waitFor(
          () => server.announcementEvents.any((e) =>
              e['slug'] == AnnouncementFixtures.verseSlug &&
              e['type'] == 'clicked' &&
              e['target'] == 'button'),
          reason: 'the click to reach the backend');
      expect(await verseShowsAtNextLaunch(app), isFalse,
          reason: 'a clicked announcement does not come back');
    });

    announcementTest(
        'hide_after_clicks: 1 with impressions_after_click: 1 shows it once '
        'more after the click, then hides it', (app) async {
      server.announcements.add({
        ...AnnouncementFixtures.verse(),
        'hide_after_clicks': 1,
        'impressions_after_click': 1,
      });
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the card before the click');
      await clickVerseButton(app);
      await app.pumpFor(const Duration(seconds: 2));
      expect(app.showsText(AnnouncementFixtures.verseTitle), isTrue,
          reason: 'the card stays after the click: a reminder follows');
      expect(await verseShowsAtNextLaunch(app), isTrue,
          reason: 'the one reminder after the click');
      expect(await verseShowsAtNextLaunch(app), isFalse,
          reason: 'hidden once its reminder was seen');
    });

    announcementTest(
        'show_again_*: seen once, it comes back once after a launch hidden',
        (app) async {
      server.announcements.add({
        ...AnnouncementFixtures.verse(),
        'max_impressions': 1,
        'count_on': 'visits',
        'show_again_times': 1,
        'show_again_after': 1,
      });
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the card at its first launch');
      await app.pumpFor(const Duration(seconds: 3));
      final launches = [
        for (var i = 0; i < 4; i++) await verseShowsAtNextLaunch(app),
      ];
      expect(launches, [false, true, false, false],
          reason: 'hidden one launch, back once, then hidden for good');
      final prefs = await SharedPreferences.getInstance();
      expect(
          jsonDecode(prefs.getString('announcements_returns') ?? '{}')
              [AnnouncementFixtures.verseSlug],
          1,
          reason: 'the device remembers it came back once');
    });

    announcementTest('show_again_* never brings back a closed card',
        (app) async {
      server.announcements.add({
        ...AnnouncementFixtures.verse(),
        'max_impressions': 5,
        'count_on': 'visits',
        'show_again_times': 3,
        'show_again_after': 1,
      });
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the card before closing it');
      await app.tapDismiss();
      await app.waitFor(() => RadioApp.announcementCard.evaluate().isEmpty,
          reason: 'the card to go once closed');
      for (var i = 0; i < 3; i++) {
        expect(await verseShowsAtNextLaunch(app), isFalse,
            reason: 'closed: launch ${i + 1} after closing');
      }
    });

    announcementTest(
        'show_after counted in playbacks: it waits for a station heard',
        (app) async {
      server.announcements.add({
        ...AnnouncementFixtures.verse(),
        'count_on': 'playbacks',
        'count_station_slugs': [Stations.alpha.slug],
        'show_after': 1,
      });
      await app.pullToRefresh();
      await app.pumpFor(const Duration(seconds: 3));
      expect(app.showsText(AnnouncementFixtures.verseTitle), isFalse,
          reason: 'no playback yet: it waits');
      expect(await verseShowsAtNextLaunch(app), isFalse,
          reason: 'a launch is no playback');

      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));
      // A playback counts once heard as long as for "Most played" (30 s).
      await app.pumpFor(const Duration(seconds: 32));
      expect(app.showsText(AnnouncementFixtures.verseTitle), isFalse,
          reason: 'a wait that ends during a launch shows it at the next');
      final prefs = await SharedPreferences.getInstance();
      expect(
          jsonDecode(prefs.getString('announcements_waited') ?? '{}')
              [AnnouncementFixtures.verseSlug],
          1,
          reason: 'the playback of alpha counted');

      expect(await verseShowsAtNextLaunch(app), isTrue,
          reason: 'it waited one playback: it shows');
      await app.pumpFor(const Duration(seconds: 3));
      expect(
          prefs.getStringList('announcements_started'),
          contains(AnnouncementFixtures.verseSlug),
          reason: 'seen once, show_after is over');
    });

    announcementTest('a share button opens the system share sheet',
        (app) async {
      const link = 'https://www.radiocrestin.ro/descarca';
      const text = 'Ascultă și tu Radio Creștin';
      server.announcements.add({
        ...AnnouncementFixtures.verse(),
        'button': {
          ...AnnouncementFixtures.verse()['button']! as Map,
          'action': {'type': 'share', 'url': link, 'share_text': text},
        },
      });
      final messenger = app.tester.binding.defaultBinaryMessenger;
      const channel = MethodChannel('dev.fluttercommunity.plus/share');
      final shared = <Map<Object?, Object?>>[];
      messenger.setMockMethodCallHandler(channel, (call) async {
        if (call.method == 'share') shared.add(call.arguments as Map);
        return 'dev.fluttercommunity.plus/share/unavailable';
      });
      try {
        await app.pullToRefresh();
        await app.waitFor(
            () => app.showsText(AnnouncementFixtures.verseTitle),
            reason: 'the share announcement');
        await app.tapText('Join the group');
        await app.waitFor(() => shared.isNotEmpty,
            reason: 'the system share sheet to open');
        expect(shared.single['text'], '$text\n$link',
            reason: "the announcement's text, then its link");
        await app.waitFor(
            () => server.announcementEvents.any((e) =>
                e['type'] == 'clicked' &&
                e['slug'] == AnnouncementFixtures.verseSlug),
            reason: 'the click to reach the backend',
            timeout: const Duration(seconds: 15));
      } finally {
        messenger.setMockMethodCallHandler(channel, null);
      }
    });

    announcementTest(
        'a list without the click rules shows a clicked card as before',
        (app) async {
      server.announcements.add(AnnouncementFixtures.verse());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the card before the click');
      await clickVerseButton(app);
      expect(await verseShowsAtNextLaunch(app), isTrue,
          reason: 'no rules: clicks never hide it');
    });

    announcementTest("an admin's own SVG icon shows on the card", (app) async {
      server.announcements.add(AnnouncementFixtures.svgIcon(server.baseUrl));
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.svgIconTitle),
          reason: 'the card with its own icon');
      await app.waitFor(
          () => find
              .descendant(
                  of: RadioApp.announcementCard,
                  matching: find.byType(SvgPicture))
              .evaluate()
              .isNotEmpty,
          reason: 'the SVG drawn in the icon tile; ${app.describeCard()}');
      expect(
          server.requests.any((r) => r.path == '/images/e2e-icon.svg'), isTrue,
          reason: 'the icon fetched from its URL');
    });

    announcementTest(
        "the station playing leads the home card with its own announcements",
        (app) async {
      server.announcements
        ..add(AnnouncementFixtures.stationNews(Stations.beta.slug))
        ..add(AnnouncementFixtures.verse());
      await app.tapStation(Stations.alpha);
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.verseTitle),
          reason: 'the home announcement while another station plays');
      expect(app.showsText(AnnouncementFixtures.stationNewsTitle), isFalse,
          reason: "another station's announcement stays out of the card");

      await app.tapStation(Stations.beta);
      await app.pullToRefresh();
      await app.waitFor(
          () => app.showsText(AnnouncementFixtures.stationNewsTitle),
          reason: "the station's own announcement first in the card; "
              '${app.describeCard()}');
      expect(app.showsText(AnnouncementFixtures.verseTitle), isFalse,
          reason: 'the home announcement comes after it');
    });

    announcementTest(
        "a station's bell opens its announcements in a full-height sheet",
        (app) async {
      server.announcements
          .add(AnnouncementFixtures.stationNews(Stations.alpha.slug));
      await app.pullToRefresh();
      await app.tapStation(Stations.alpha);
      await app.waitFor(() => app.findsKey('station-announcements-bell'),
          reason: 'the bell on the mini player');
      expect(app.findsKey('station-announcements-strip'), isFalse,
          reason: 'no strip on top of the mini player');

      await app.tapKey('station-announcements-bell');
      await app.waitFor(() => app.showsText('Anunțuri ale postului'),
          reason: "the station's announcements sheet");
      expect(app.showsText(AnnouncementFixtures.stationNewsTitle), isTrue);
      final screen = app.tester.view.physicalSize.height /
          app.tester.view.devicePixelRatio;
      expect(app.tester.getTopLeft(find.text('Anunțuri ale postului')).dy,
          lessThan(screen * 0.2),
          reason: 'the sheet rises to the top, like a page');

      await app.tapTooltip('Închide');
      await app.pumpFor(const Duration(seconds: 1));
      expect(app.findsKey('station-announcements-bell'), isTrue,
          reason: 'the bell stays');
    });

    announcementTest(
        "the station playing leads with all its own announcements, in the "
        "feed's order, whatever the rotation; the home ones after them, and "
        'without them, rotate as before', (app) async {
      final second = {
        ...AnnouncementFixtures.stationNews(Stations.alpha.slug),
        'position': 3,
      };
      final items = [
        AnnouncementFixtures.verse(),
        AnnouncementFixtures.shareAThon(Stations.alpha.slug),
        AnnouncementFixtures.concert(),
        second,
        AnnouncementFixtures.newest(),
      ];
      const rotate = {'rotation_mode': 'rotate'};
      bool showsStationNews() => [
            AnnouncementFixtures.shareAThonTitle,
            AnnouncementFixtures.stationNewsTitle,
          ].any((title) => find
              .descendant(
                  of: RadioApp.announcementCard, matching: find.text(title))
              .hitTestable()
              .evaluate()
              .isNotEmpty);

      // Another station: the home ones only, rotating launch by launch.
      await app.tapStation(Stations.beta);
      await launchWith(app, items, settings: rotate, shown: 3);
      expect(app.showsText(AnnouncementFixtures.verseTitle), isTrue,
          reason: 'the first launch starts at the first home one; '
              'card: ${app.describeCard()}');
      await launchWith(app, items, settings: rotate, shown: 3);
      expect(app.showsText(AnnouncementFixtures.concertTitle), isTrue,
          reason: 'the next launch starts one further; '
              'card: ${app.describeCard()}');

      // Its own station: its two first, as listed, then the home ones
      // from this launch's start (the second).
      Future<void> expectTurn(List<String> titles) async {
        for (final (index, title) in titles.indexed) {
          if (index > 0) await app.tapKey('announcement-next');
          final counter = '${index + 1} din ${titles.length}';
          await app.waitFor(
              () => app.showsPosition(counter) && app.showsText(title),
              reason: '$counter, "$title"; card: ${app.describeCard()}');
        }
      }

      const own = [
        AnnouncementFixtures.shareAThonTitle,
        AnnouncementFixtures.stationNewsTitle,
      ];
      await app.tapStation(Stations.alpha);
      await app.scrollToTop();
      await expectTurn([
        ...own,
        AnnouncementFixtures.concertTitle,
        AnnouncementFixtures.newestTitle,
        AnnouncementFixtures.verseTitle,
      ]);

      // A launch while it plays: its own still lead, and the home ones
      // start one further (the third).
      await launchWith(app, items, settings: rotate);
      await expectTurn([
        ...own,
        AnnouncementFixtures.newestTitle,
        AnnouncementFixtures.verseTitle,
        AnnouncementFixtures.concertTitle,
      ]);

      // Back on another station: the home ones, from this launch's start,
      // and the one on screen (the last) stays there.
      await app.tapStation(Stations.beta);
      await app.scrollToTop();
      for (final (counter, title) in [
        ('3 din 3', AnnouncementFixtures.concertTitle),
        ('2 din 3', AnnouncementFixtures.verseTitle),
        ('1 din 3', AnnouncementFixtures.newestTitle),
      ]) {
        if (counter != '3 din 3') await app.tapKey('announcement-previous');
        await app.waitFor(
            () => app.showsPosition(counter) && app.showsText(title),
            reason: 'the home ones, $counter "$title"; '
                'card: ${app.describeCard()}');
      }
      expect(showsStationNews(), isFalse);
    });

    announcementTest(
        "the Share-A-Thon card, led by its station playing, shows its whole "
        'description, the second paragraph on a line of its own, and its '
        'link opens', (app) async {
      await app.tapStation(Stations.beta);
      await launchWith(app, [
        AnnouncementFixtures.verse(),
        AnnouncementFixtures.shareAThon(Stations.alpha.slug),
      ], shown: 1);
      await app.tapStation(Stations.alpha);
      await app.scrollToTop();
      await app.waitFor(
          () =>
              app.showsPosition('1 din 2') &&
              app.showsText(AnnouncementFixtures.shareAThonTitle),
          reason: 'the Share-A-Thon card first; card: ${app.describeCard()}');
      await app.pumpFor(const Duration(seconds: 1));
      final width = app.tester.getSize(find.byType(Scaffold).first).width;
      final description = find
          .descendant(
              of: find.byKey(const ValueKey(
                  'announcement-${AnnouncementFixtures.shareAThonSlug}')),
              matching: find.byType(InlineMarkdownText))
          .hitTestable()
          .first;
      await expectWholeDescription(app, description,
          where: 'Home, ${width.round()} px wide');
      await expectLinkOpens(app, description);
    });

    announcementTest(
        'the Share-A-Thon description fits whole at 375 and 402 px, its '
        'second paragraph on a line of its own', (app) async {
      final items = [
        Announcement.fromJson(
            AnnouncementFixtures.shareAThon(Stations.alpha.slug))!,
        Announcement.fromJson(AnnouncementFixtures.verse())!,
      ];
      final service = GetIt.instance<AnnouncementsService>();
      for (final width in [375.0, 402.0]) {
        await app.tester.pumpWidget(MaterialApp(
          theme: darkTheme,
          home: Scaffold(
            body: Builder(
              builder: (context) => MediaQuery(
                data: MediaQuery.of(context).copyWith(
                    size: Size(width, MediaQuery.of(context).size.height)),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: SizedBox(
                    width: width,
                    // Two announcements, as production has: the arrows show.
                    child: AnnouncementCard(
                      items: items,
                      service: service,
                      margin: const EdgeInsets.all(StationsList.cardSideInset),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ));
        await app.pumpFor(const Duration(milliseconds: 600));
        final description =
            find.byType(InlineMarkdownText).hitTestable().first;
        await expectWholeDescription(app, description,
            where: '${width.toInt()} px');
        await expectLinkOpens(app, description);
        expect(app.tester.takeException(), isNull, reason: 'no overflow');
      }
    });

    announcementTest(
        "a description's blank line starts a new line, as the API's "
        'body_html; a single line break is a space; links work on any line',
        (app) async {
      final tapped = <String>[];
      final cases = {
        'One\nTwo': 'One Two',
        'One\n\nTwo': 'One\nTwo',
        'One\r\n \r\n\r\nTwo\n': 'One\nTwo',
        'One\n\nTwo\nthree\n\n**Four** [five](https://example.com/5)':
            'One\nTwo three\nFour five',
      };
      await app.tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Column(children: [
            for (final (index, markdown) in cases.keys.indexed)
              InlineMarkdownText(
                markdown,
                key: ValueKey('markdown-$index'),
                style: const TextStyle(fontSize: 14),
                strongColor: Colors.black,
                emphasisColor: Colors.black,
                linkColor: Colors.blue,
                onTapLink: tapped.add,
              ),
          ]),
        ),
      ));
      await app.tester.pump();
      for (final (index, MapEntry(key: markdown, value: text))
          in cases.entries.indexed) {
        final paragraph = app.tester.renderObject<RenderParagraph>(find
            .descendant(
                of: find.byKey(ValueKey('markdown-$index')),
                matching: find.byType(RichText))
            .first);
        expect(paragraph.text.toPlainText(), text,
            reason: 'the text of ${jsonEncode(markdown)}');
      }
      await tapText(app, find.byKey(const ValueKey('markdown-3')), 'five');
      expect(tapped, ['https://example.com/5'],
          reason: 'the link after a paragraph break opens');
    });

    announcementTest('a form opens in a sheet, themed like the app',
        (app) async {
      server.announcements.add(AnnouncementFixtures.poll());
      await app.pullToRefresh();
      await app.waitFor(() => app.showsText(AnnouncementFixtures.formButton),
          reason: 'the poll card');

      await app.tapText(AnnouncementFixtures.formButton);
      await app.waitFor(
          () => server.requests.any((r) =>
              r.path ==
                  '/api/v1/forms/${AnnouncementFixtures.formSlug}/page/' &&
              {'dark', 'light'}.contains(r.query['theme'])),
          reason: 'the form page to load with the theme');
      final page = server.requests.lastWhere((r) =>
          r.path == '/api/v1/forms/${AnnouncementFixtures.formSlug}/page/');
      expect(page.query.containsKey('device_id'), isFalse,
          reason: 'the device stays in the fragment, out of the cache key');
      await app.waitFor(() => !app.findsKey('form-skeleton'),
          reason: 'the page to say it is ready',
          timeout: const Duration(seconds: 30));

      await app.tapTooltip('Închide');
      await app.waitFor(() => app.showsText(AnnouncementFixtures.formButton),
          reason: 'Home again after closing the form');
    });
  });

  group('Stories', () {
    /// Runs [body] from a device that never saw a story, and leaves none
    /// behind for the tests after it.
    void storyTest(
      String description,
      Future<void> Function(RadioApp app) body,
    ) =>
        test(description, (app) async {
          await _forgetStories(app);
          try {
            await body(app);
          } finally {
            server.stories.clear();
            await _forgetStories(app);
          }
        });

    Story story(Map<String, Object?> json) => Story.fromJson(json)!;
    String base() => server.baseUrl;

    test('the display rules: due, highlighted, max shows and auto-open',
        (app) async {
      final now = DateTime.utc(2026, 12, 2, 18);
      final daily = story({
        ...StoryFixtures.autoOpen(base(), everyDays: 3, everyActions: 10),
      });
      final once = story(StoryFixtures.autoOpen(base(), maxShows: 2));
      final schedule = StorySchedule(now: now, actions: 30);
      StoryHistory shown({int shows = 1, int daysAgo = 0, int actions = 30}) =>
          StoryHistory(
            shows: shows,
            lastShownAt: now.subtract(Duration(days: daysAgo)),
            actionsAtLastShow: actions,
            seenSlides: {for (final s in daily.slides) s.id},
          );

      expect(schedule.isDue(daily, StoryHistory.none), isTrue,
          reason: 'never shown: due');
      expect(schedule.isDue(daily, shown(daysAgo: 1)), isFalse,
          reason: 'shown yesterday, no actions since');
      expect(schedule.isDue(daily, shown(daysAgo: 3)), isTrue,
          reason: 'every_days reached');
      expect(schedule.isDue(daily, shown(daysAgo: 1, actions: 20)), isTrue,
          reason: 'every_actions reached first');
      expect(schedule.isDue(once, shown(daysAgo: 30)), isFalse,
          reason: 'no interval: due only until its first show');
      expect(schedule.isListed(once, shown()), isTrue);
      expect(schedule.isListed(once, shown(shows: 2)), isFalse,
          reason: 'max_shows reached: it leaves the bar');
      expect(schedule.isHighlighted(daily, shown(daysAgo: 1)), isFalse);
      expect(
          schedule.isHighlighted(
              daily,
              StoryHistory(
                  shows: 1, lastShownAt: now, actionsAtLastShow: 30)),
          isTrue,
          reason: 'a slide never seen keeps the ring coloured');
      final ended = story({
        ...StoryFixtures.verse(base()),
        'ends_at': now.toIso8601String(),
      });
      expect(schedule.isListed(ended, StoryHistory.none), isFalse,
          reason: 'its window ended');

      final seen = story(StoryFixtures.verse(base()));
      final fresh = story(StoryFixtures.teaser(base()));
      final histories = {
        seen.slug: StoryHistory(
          shows: 1,
          lastShownAt: now.subtract(const Duration(days: 1)),
          actionsAtLastShow: 30,
          seenSlides: {for (final slide in seen.slides) slide.id},
        ),
      };
      StoryHistory historyOf(String slug) =>
          histories[slug] ?? StoryHistory.none;
      expect(schedule.bar([seen, fresh], historyOf).map((s) => s.slug),
          [fresh.slug, seen.slug],
          reason: 'due stories first');

      Story? autoOpen({bool openedThisLaunch = false, int? lastAt}) =>
          schedule.autoOpen([seen, daily], historyOf,
              openedThisLaunch: openedThisLaunch,
              actionsAtLastAutoOpen: lastAt,
              gapActions: 20);
      expect(autoOpen()?.slug, daily.slug,
          reason: 'the first due story that opens by itself');
      expect(autoOpen(openedThisLaunch: true), isNull,
          reason: 'one per app open');
      expect(autoOpen(lastAt: 15), isNull, reason: 'within the gap');
      expect(autoOpen(lastAt: 10)?.slug, daily.slug,
          reason: 'the gap passed');
    });

    test('the viewer state: on, back, pause, players and the end',
        (app) async {
      final shownSlides = <String>[];
      final completed = <String>[];
      var finished = false;
      final controller = StoryViewerController(
        stories: [
          story(StoryFixtures.verse(base())),
          story(StoryFixtures.teaser(base())),
        ],
        onSlideShown: (story, slide) => shownSlides.add(slide.id),
        onStoryCompleted: (story) => completed.add(story.slug),
        onFinished: () => finished = true,
      )..start();
      expect(shownSlides, ['401']);
      controller.tick(const Duration(seconds: 2));
      expect(controller.progress, closeTo(0.5, 0.01));
      controller.pause(StoryPause.hold);
      controller.tick(const Duration(seconds: 2));
      expect(controller.progress, closeTo(0.5, 0.01),
          reason: 'holding stops the timer');
      controller.resume(StoryPause.hold);
      controller.tick(const Duration(seconds: 2));
      expect(controller.slideIndex, 1, reason: 'the slide ran out');
      expect(controller.barProgress(0), 1);
      controller.previous();
      expect(controller.slideIndex, 0);
      controller.next();
      controller.next();
      expect(completed, [StoryFixtures.verseSlug]);
      expect(controller.story.slug, StoryFixtures.teaserSlug);
      controller.tick(const Duration(seconds: 10));
      expect(controller.slideIndex, 0,
          reason: 'a video sets its own pace, not the timer');
      controller.playerProgress(
          const Duration(seconds: 1), const Duration(seconds: 4));
      expect(controller.progress, closeTo(0.25, 0.01));
      expect(controller.slideDuration, const Duration(seconds: 4));
      controller.slideEnded();
      expect(controller.slideIndex, 1);
      controller.previous();
      controller.previous();
      expect(controller.story.slug, StoryFixtures.verseSlug,
          reason: 'back from a first slide: the previous story');
      controller.showStory(1);
      controller.next();
      controller.next();
      expect(finished, isTrue, reason: 'the last story ended');
      expect(shownSlides, ['401', '402', '401', '402', '411', '412', '411',
          '401', '411', '412']);
      controller.dispose();
    });

    test('the CTA comes in after 4 s of play, or 30% of the slide sooner',
        (app) async {
      Duration ms(int n) => Duration(milliseconds: n);
      const six = Duration(seconds: 6);
      expect(StoryCtaTiming.showAt(six), ms(1800));
      expect(StoryCtaTiming.showAt(const Duration(seconds: 10)), ms(3000));
      expect(StoryCtaTiming.showAt(ms(14500)), ms(4000));
      expect(StoryCtaTiming.showAt(const Duration(seconds: 60)), ms(4000));
      expect(StoryCtaTiming.phaseAt(ms(1799), six), StoryCtaPhase.hidden);
      expect(StoryCtaTiming.phaseAt(ms(1800), six), StoryCtaPhase.shown);
      expect(StoryCtaTiming.phaseAt(ms(2799), six), StoryCtaPhase.shown);
      expect(StoryCtaTiming.phaseAt(ms(2800), six), StoryCtaPhase.filled,
          reason: 'its colour a second after it comes in');

      final controller = StoryViewerController(stories: [
        story(StoryFixtures.verse(base())),
        story(StoryFixtures.teaser(base())),
      ])
        ..start();
      // A 4 s picture: in at 1.2 s of play, its colour at 2.2 s.
      controller.tick(ms(1000));
      expect(controller.ctaPhase, StoryCtaPhase.hidden);
      controller.pause(StoryPause.hold);
      controller.tick(ms(2000));
      expect(controller.ctaPhase, StoryCtaPhase.hidden,
          reason: 'a hold stops the count');
      controller.resume(StoryPause.hold);
      controller.tick(ms(300));
      expect(controller.ctaPhase, StoryCtaPhase.shown);
      controller.tick(ms(1000));
      expect(controller.ctaPhase, StoryCtaPhase.filled);
      controller.next();
      expect(controller.ctaPhase, StoryCtaPhase.hidden,
          reason: 'each slide counts afresh');

      // A 3 s video counts its own position: in at 0.9 s.
      controller.showStory(1);
      controller.tick(const Duration(seconds: 10));
      expect(controller.ctaPhase, StoryCtaPhase.hidden,
          reason: 'the timer doesn\'t count for a video');
      controller.playerProgress(ms(800), const Duration(seconds: 3));
      expect(controller.ctaPhase, StoryCtaPhase.hidden);
      controller.playerProgress(ms(950), const Duration(seconds: 3));
      expect(controller.ctaPhase, StoryCtaPhase.shown);
      controller.playerProgress(ms(500), const Duration(seconds: 3));
      expect(controller.ctaPhase, StoryCtaPhase.shown,
          reason: 'a seek back doesn\'t hide it again');
      controller.dispose();
    });

    test('the CTA routing: what each target does, and the app link order',
        (app) async {
      StoryCtaTarget target(Map<String, Object?> json) =>
          StoryCtaTarget.fromJson(json)!;
      expect(
          StoryCtaRouter.plan(
              target({'type': 'url', 'url': 'https://radiocrestin.ro'})),
          StoryCtaPlan.leaveApp);
      expect(
          StoryCtaRouter.plan(target(
              {'type': 'in_app', 'route': 'station', 'slug': 'e2e-alpha'})),
          StoryCtaPlan.closeThenOpen);
      expect(
          StoryCtaRouter.plan(target({'type': 'in_app', 'route': 'share'})),
          StoryCtaPlan.sheet);
      expect(
          StoryCtaRouter.plan(
              target({'type': 'story', 'story_slug': 'other'})),
          StoryCtaPlan.showStory);

      final youtube = target({
        'type': 'app_link',
        'app_url': StoryFixtures.youtubeUrl,
        'fallback_url': StoryFixtures.youtubeUrl,
      });
      expect(
          StoryCtaRouter.appLinkAttempts(youtube)
              .map((a) => '${a.$1} ${a.$2.name}'),
          [
            '${StoryFixtures.youtubeUrl} externalNonBrowserApplication',
            '${StoryFixtures.youtubeUrl} externalApplication',
          ],
          reason: 'the app if installed, else the browser');
      final spotify = target({
        'type': 'app_link',
        'app_url': 'spotify:track:1',
        'fallback_url': 'https://open.spotify.com/track/1',
      });
      expect(
          StoryCtaRouter.appLinkAttempts(spotify)
              .map((a) => '${a.$1} ${a.$2.name}'),
          [
            'spotify:track:1 externalApplication',
            'https://open.spotify.com/track/1 externalApplication',
          ]);
      expect(StoryCtaRouter.appLink('javascript:alert(1)'), isNull);
      expect(StoryCtaRouter.appLink('intent://x#Intent;end'), isNull);

      final unknown = StoryCtaTarget.fromJson({
        'type': 'in_app',
        'route': 'radio-quiz',
        'fallback_url': 'https://radiocrestin.ro/quiz',
      });
      expect(unknown?.type, StoryCtaTargetType.url,
          reason: 'an unknown route opens its fallback');
      expect(unknown?.url, 'https://radiocrestin.ro/quiz');
      expect(
          StoryCta.fromJson({
            'style': 'swipe_up',
            'label': 'x',
            'target': {'type': 'hologram'},
          }),
          isNull,
          reason: 'an unknown target without a fallback hides the CTA');
    });

    test('a story link opens the story; station links still play stations',
        (app) async {
      const slug = 'concert-craciun-2026';
      for (final link in [
        'https://www.radiocrestin.ro/poveste/$slug/',
        'https://www.radiocrestin.ro/poveste/$slug',
        'https://radiocrestin.ro/poveste/$slug/?utm_source=whatsapp',
        'radiocrestin://poveste/$slug',
        'radiocrestin:///poveste/$slug',
      ]) {
        final uri = Uri.parse(link);
        expect(storySlugFromUri(uri), slug, reason: link);
        expect(Utils.stationSlugFromUri(uri), '',
            reason: '$link names no station');
      }
      for (final (link, station) in [
        ('radiocrestin://radio-vocea-evangheliei', 'radio-vocea-evangheliei'),
        ('https://www.radiocrestin.ro/radio-vocea-evangheliei',
            'radio-vocea-evangheliei'),
        ('https://share.radiocrestin.ro/poveste-de-seara', 'poveste-de-seara'),
      ]) {
        final uri = Uri.parse(link);
        expect(storySlugFromUri(uri), isNull, reason: link);
        expect(Utils.stationSlugFromUri(uri), station, reason: link);
      }
      for (final link in [
        'https://www.radiocrestin.ro/poveste/',
        'radiocrestin://poveste',
        'https://www.radiocrestin.ro/poveste/<script>/',
      ]) {
        expect(storySlugFromUri(Uri.parse(link)), isNull, reason: link);
      }
    });

    storyTest(
        'a story a link names but the list lacks is fetched by its slug',
        (app) async {
      server.stories.add(StoryFixtures.verse(base()));
      // Not in the list this device kept: only the single-story endpoint.
      final story = await app.stories.find(StoryFixtures.verseSlug);
      expect(story?.title, StoryFixtures.verseTitle);
      expect(await app.stories.find('e2e-gone'), isNull);
    });

    test('the new keys: comments, author, caption, CTA colours; counts',
        (app) async {
      final plain = story(StoryFixtures.verse(base()));
      expect(plain.comments.enabled, isFalse,
          reason: 'comments are off unless the admin turns them on');
      expect(story({
        ...StoryFixtures.verse(base()),
        'comments': {'enabled': false, 'placeholder': 'x', 'count': 3},
      }).comments.enabled, isFalse);
      expect(plain.author, isNull);
      final full = story({
        ...StoryFixtures.verse(base(), comments: true),
        'author': {'name': 'Radio Vocea Evangheliei', 'avatar_url': null},
      });
      expect(full.comments.enabled, isTrue);
      expect(full.comments.hint, StoryFixtures.commentPlaceholder);
      expect(story({
        ...StoryFixtures.verse(base()),
        'comments': {'enabled': true, 'placeholder': null, 'count': 12},
      }).comments.hint, StoryComments.defaultPlaceholder);
      expect(StoryComments.defaultPlaceholder, contains('public'),
          reason: 'the field says the comment is public');
      expect(full.author?.name, 'Radio Vocea Evangheliei');
      expect(full.slides.first.caption, StoryFixtures.caption);
      final cta = StoryCta.fromJson({
        'style': 'button',
        'label': 'Vezi',
        'color': '#2D5BFF',
        'text_color': '#FFFFFF',
        'target': {'type': 'url', 'url': 'https://radiocrestin.ro'},
      });
      expect(cta?.color, const Color(0xFF2D5BFF));
      expect(formatStoryCount(2229), '2.229');
      expect(formatStoryCount(152340), '152.340');
      expect(formatStoryCount(7), '7');
      final now = DateTime(2026, 11, 26, 12);
      expect(storyCommentAge(now.subtract(const Duration(seconds: 20)),
          now: now), 'acum');
      expect(storyCommentAge(now.subtract(const Duration(minutes: 5)),
          now: now), 'acum 5 min');
      expect(storyCommentAge(now.subtract(const Duration(hours: 3)),
          now: now), 'acum 3 h');
      expect(storyCommentAge(now.subtract(const Duration(days: 1)),
          now: now), 'ieri');
      expect(StoryComment.fromJson({'id': 7, 'text': 'Amin',
          'author_name': null, 'created_at': '2026-11-26T10:00:00Z'})
          ?.authorName, StoryComment.anonymousName);
      expect(StoryComment.fromJson({'id': 8, 'text': 'Amin',
          'author_name': 'Ana', 'author_avatar_url': 'https://x/a.webp'})
          ?.authorAvatarUrl, 'https://x/a.webp');
      final profile = StoryCommentAccess.fromJson({
        'can_comment': true,
        'profile': {'name': 'Ana', 'avatar_url': null},
      });
      expect(profile.canComment, isTrue);
      expect(profile.profile?.name, 'Ana');
      expect(StoryCommentAccess.fromJson({'can_comment': false}).canComment,
          isFalse, reason: 'only profiles comment, and this phone has none');
      expect(StoryCommentAccess.fromJson({}).canComment, isTrue,
          reason: 'an API before profiles lets everyone comment');
    });

    storyTest(
        'a phone with a profile gets the comment field, told it is public '
        'and as whom; it holds the story, posts as the profile, and lists '
        'it with the others, with their pictures', (app) async {
      server
        ..stories.add(StoryFixtures.verse(base(), comments: true))
        ..storyCommentProfile = {
          'name': 'Ana',
          'avatar_url': '${base()}/images/profile-ana.png',
        }
        ..storyComments[StoryFixtures.verseSlug] = [
          {
            'id': 1,
            'author_name': 'Maria',
            'text': 'Ce verset frumos!',
            'created_at': DateTime.now().toUtc().toIso8601String(),
            'device_id': 'someone-else',
          },
        ];
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      final viewer = await app.waitForStory(StoryFixtures.verseSlug);
      await app.waitFor(() => app.findsKey('story-comment-field'),
          reason: 'the field, once the API says this phone may comment');
      await app.pumpFor(StoryCtaReveal.riseDuration);
      // The field lies over its hint: it is there, not hit-testable.
      expect(find.text(StoryFixtures.commentPlaceholder), findsOneWidget,
          reason: 'the admin\'s placeholder');
      expect(app.showsText(StoryFixtures.caption), isTrue,
          reason: 'the slide\'s caption');
      final field = find.byKey(const ValueKey('story-comment-field'));
      await app.tester.tap(field.hitTestable());
      await app.pumpFor(const Duration(milliseconds: 500));
      expect(viewer.controller.pauses, contains(StoryPause.comment),
          reason: 'the story waits while the listener writes');
      await app.waitFor(
          () => find
              .byKey(const ValueKey('story-comment-public'))
              .evaluate()
              .isNotEmpty,
          reason: 'it says the comment is public, and as whom');
      expect(
          find.descendant(
              of: find.byKey(const ValueKey('story-comment-public')),
              matching: find.byType(StoryAvatar)),
          findsOneWidget,
          reason: 'with the profile\'s picture');
      expect(find.textContaining('Ana'), findsWidgets,
          reason: 'and its name');

      final held = viewer.controller.progress;
      await app.tester.enterText(field, 'Vă mulțumim!');
      await app.pumpFor(const Duration(seconds: 2));
      expect(viewer.controller.progress, closeTo(held, 0.02));
      await app.tapKey('story-comment-send');
      await app.waitFor(() => server.postedComments.isNotEmpty,
          reason: 'the comment to reach the API');
      final posted = server.postedComments.single;
      expect(posted['text'], 'Vă mulțumim!');
      expect(posted.containsKey('author_name'), isFalse,
          reason: 'the profile signs it, not a name the app sends');
      expect(posted['slide'], 401);
      await app.waitFor(() => app.showsText('Comentariu publicat'),
          reason: 'the listener told it is published');
      expect(app.findsKey('story-comments'), isTrue);
      expect(find.descendant(
              of: find.byKey(const ValueKey('story-comments')),
              matching: find.text('2')),
          findsOneWidget,
          reason: 'Maria\'s and ours: the count goes up at once');

      await app.tapKey('story-comments');
      await app.waitFor(() => app.showsText('Ce verset frumos!'),
          reason: 'the comments sheet with the others\' comments');
      expect(app.showsText('Vă mulțumim!'), isTrue, reason: 'and ours');
      expect(viewer.controller.pauses, contains(StoryPause.sheet),
          reason: 'the story waits under the sheet');
      final mine = server.storyComments[StoryFixtures.verseSlug]!.first['id'];
      // Maria has no picture: her initial; Ana's comment, her picture.
      expect(
          find.descendant(
              of: find.byKey(const ValueKey('story-comment-avatar-1')),
              matching: find.text('M')),
          findsOneWidget,
          reason: 'a profile without a picture shows its initial');
      expect(
          find.descendant(
              of: find.byKey(ValueKey('story-comment-avatar-$mine')),
              matching: find.byType(Image)),
          findsOneWidget,
          reason: 'our comment shows the profile\'s picture');
      expect(app.findsKey('story-comment-delete-1'), isFalse,
          reason: 'another listener\'s comment can\'t be deleted');
      await app.tapKey('story-comment-delete-$mine');
      await app.waitFor(() => !app.showsText('Vă mulțumim!'),
          reason: 'our own comment deleted');
      expect(server.storyComments[StoryFixtures.verseSlug], hasLength(1));
    });

    storyTest(
        'over the comments limit (429) the listener is told to try later, '
        'once, and keeps the text', (app) async {
      server
        ..stories.add(StoryFixtures.verse(base(), comments: true))
        ..storyCommentProfile = {'name': 'Ana', 'avatar_url': null}
        ..storyCommentsLimited = true;
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      await app.waitForStory(StoryFixtures.verseSlug);
      await app.waitFor(() => app.findsKey('story-comment-field'),
          reason: 'the field for a profile');
      await app.pumpFor(StoryCtaReveal.riseDuration);
      final field = find.byKey(const ValueKey('story-comment-field'));
      await app.tester.tap(field.hitTestable());
      await app.tester.enterText(field, 'Încă un comentariu');
      await app.pumpFor(const Duration(milliseconds: 500));
      await app.tapKey('story-comment-send');
      await app.waitFor(
          () => find
              .textContaining('Ai trimis multe comentarii')
              .evaluate()
              .isNotEmpty,
          reason: 'the listener told to try again later');
      await app.pumpFor(const Duration(seconds: 2));
      expect(server.postedComments, hasLength(1), reason: 'never retried');
      expect(find.text('Încă un comentariu'), findsOneWidget,
          reason: 'the text stays to send later');
    });

    storyTest(
        'only profiles comment: a phone without one reads the comments, '
        'with no field to write', (app) async {
      server
        ..stories.add(StoryFixtures.verse(base(), comments: true))
        ..storyComments[StoryFixtures.verseSlug] = [
          {
            'id': 1,
            'author_name': 'Maria',
            'text': 'Ce verset frumos!',
            'created_at': DateTime.now().toUtc().toIso8601String(),
            'device_id': 'someone-else',
          },
        ];
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      await app.waitForStory(StoryFixtures.verseSlug);
      await app.waitFor(
          () =>
              app.stories.commentAccess.value[StoryFixtures.verseSlug] !=
              null,
          reason: 'the API to say whether this phone may comment');
      await app.pumpFor(const Duration(milliseconds: 500));
      expect(app.findsKey('story-comment-field'), isFalse,
          reason: 'no profile: no field');
      await app.tapKey('story-comments');
      await app.waitFor(() => app.showsText('Ce verset frumos!'),
          reason: 'the comments, to read');
      expect(app.findsKey('story-comment-field'), isFalse,
          reason: 'no field in the sheet either');
    });

    storyTest('comments are off by default: no field, no comments button',
        (app) async {
      server.stories.add(StoryFixtures.verse(base()));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      await app.waitForStory(StoryFixtures.verseSlug);
      expect(app.findsKey('story-comment-field'), isFalse);
      expect(app.findsKey('story-comments'), isFalse);
    });

    storyTest(
        'the bar shows new stories first with a coloured ring, and a '
        'story once seen after them, grey', (app) async {
      server.stories
        ..add(StoryFixtures.verse(base()))
        ..add(StoryFixtures.teaser(base()));
      await app.coldStartStories();
      await app.waitFor(
          () => app.findsKey('story-bubble-${StoryFixtures.verseSlug}'),
          reason: 'the bubbles on Home');
      expect(app.storyBar,
          ['${StoryFixtures.verseSlug}*', '${StoryFixtures.teaserSlug}*']);

      // The viewer grows out of the tapped bubble, as on Instagram (its
      // frames can't be timed here: a debug build's first frame of the
      // viewer comes after the 300 ms the zoom takes).
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      final route = <String>[];
      find.byType(StoryViewerPage).evaluate().first.visitAncestorElements((e) {
        route.add(e.widget.runtimeType.toString());
        return route.length < 12;
      });
      expect(route, contains('_GrowFromBubble'),
          reason: 'opened growing out of the bubble: ${route.join(' < ')}');
      await app.waitForStory(StoryFixtures.verseSlug);
      app.storyViewer!.controller.next();
      await app.waitForStory(StoryFixtures.verseSlug);
      await app.tapKey('story-close');
      await app.waitFor(() => app.storyViewer == null,
          reason: 'the viewer to close');
      expect(app.storyBar,
          ['${StoryFixtures.teaserSlug}*', StoryFixtures.verseSlug],
          reason: 'the seen story goes after the new one, without its '
              'ring; ${app.describeStories()}');
      await app.waitFor(
          () => server.storyEventsOf('slide_view').length >= 2,
          reason: 'the seen slides to reach the API');
      expect(server.storyEventsOf('view').single['story'],
          StoryFixtures.verseSlug);
    });

    storyTest(
        'a tap goes on or back, holding pauses, and the last slide '
        'closes the viewer', (app) async {
      server.stories.add(StoryFixtures.verse(base()));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      final viewer = await app.waitForStory(StoryFixtures.verseSlug);
      final size = app.tester.view.physicalSize / app.tester.view.devicePixelRatio;
      await app.tester.tapAt(Offset(size.width * 0.8, size.height / 2));
      await app.pumpFor(const Duration(milliseconds: 400));
      expect(viewer.controller.slideIndex, 1, reason: 'right: on');
      await app.tester.tapAt(Offset(size.width * 0.15, size.height / 2));
      await app.pumpFor(const Duration(milliseconds: 400));
      expect(viewer.controller.slideIndex, 0, reason: 'left: back');

      final hold = await app.tester
          .startGesture(Offset(size.width / 2, size.height / 2));
      await app.pumpFor(const Duration(milliseconds: 800));
      final held = viewer.controller.progress;
      await app.pumpFor(const Duration(seconds: 2));
      expect(viewer.controller.progress, closeTo(held, 0.02),
          reason: 'holding pauses; ${app.describeStories()}');
      expect(viewer.controller.pauses, contains(StoryPause.hold));
      await hold.up();
      await app.pumpFor(const Duration(milliseconds: 600));
      expect(viewer.controller.progress, greaterThan(held),
          reason: 'letting go goes on');

      await app.waitFor(() => app.storyViewer == null,
          reason: 'the viewer to close after the last slide',
          timeout: const Duration(seconds: 15));
      await app.waitFor(() => server.storyEventsOf('complete').isNotEmpty,
          reason: 'the completion to reach the API');
    });

    storyTest(
        'a swipe to the left turns to the next story, to the right back',
        (app) async {
      server.stories
        ..add(StoryFixtures.verse(base(), comments: true))
        ..add(StoryFixtures.teaser(base()));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      final viewer = await app.waitForStory(StoryFixtures.verseSlug);
      final size =
          app.tester.view.physicalSize / app.tester.view.devicePixelRatio;

      // Halfway, the story turns as the outside of a cube does, as on
      // Instagram: the edge it shares with the next one comes nearer
      // (taller) and its far side falls away (shorter).
      final slide = find.byKey(ValueKey('story-slide-'
          '${StoryFixtures.verseSlug}-${viewer.controller.slide.id}'));
      final before = app.tester.element(slide);
      final turn = await app.tester
          .startGesture(Offset(size.width * 0.9, size.height / 2));
      Future<void> move() async {
        for (var i = 0; i < 10; i++) {
          await turn.moveBy(Offset(-size.width * 0.04, 0));
          await app.tester.pump(const Duration(milliseconds: 16));
        }
      }

      await move();
      final farSide = app.tester.getBottomLeft(slide).dy -
          app.tester.getTopLeft(slide).dy;
      final sharedEdge = app.tester.getBottomRight(slide).dy -
          app.tester.getTopRight(slide).dy;
      expect(sharedEdge, greaterThan(farSide * 1.05),
          reason: 'the shared edge ($sharedEdge) nearer than the far side '
              '($farSide)');
      expect(app.tester.element(slide), same(before),
          reason: 'the slide turns without starting again');
      expect(viewer.controller.pauses, contains(StoryPause.turn),
          reason: 'the story waits while the finger turns it');
      final held = viewer.controller.progress;
      await app.pumpFor(const Duration(seconds: 1));
      expect(viewer.controller.progress, held);
      await move();
      await turn.up();
      await app.pumpFor(const Duration(seconds: 1));
      expect(viewer.controller.pauses, isNot(contains(StoryPause.turn)),
          reason: 'the next story runs once turned');
      expect(viewer.controller.story.slug, StoryFixtures.teaserSlug,
          reason: 'left: the next story; ${app.describeStories()}');
      await app.tester.timedDragFrom(Offset(size.width * 0.1, size.height / 2),
          Offset(size.width * 0.85, 0), const Duration(milliseconds: 800));
      await app.pumpFor(const Duration(seconds: 1));
      expect(viewer.controller.story.slug, StoryFixtures.verseSlug,
          reason: 'right: back; ${app.describeStories()}');
    });

    storyTest('a swipe down closes the viewer', (app) async {
      server.stories.add(StoryFixtures.verse(base()));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      await app.waitForStory(StoryFixtures.verseSlug);
      final size = app.tester.view.physicalSize / app.tester.view.devicePixelRatio;
      await app.tester.timedDragFrom(Offset(size.width / 2, size.height / 3),
          const Offset(0, 300), const Duration(milliseconds: 300));
      await app.waitFor(() => app.storyViewer == null,
          reason: 'the viewer to close');
    });

    storyTest(
        'a like shows at once and reaches the API; tapping again takes '
        'it back', (app) async {
      server.stories.add(StoryFixtures.verse(base(), likeCount: 4));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      final viewer = await app.waitForStory(StoryFixtures.verseSlug);
      final like = 'story-like-${StoryFixtures.verseSlug}';
      await app.tapKey(like);
      expect(app.stories.isLiked(StoryFixtures.verseSlug), isTrue);
      expect(app.findsKey('story-likes-5'), isTrue,
          reason: 'the count under the heart goes up at once');
      await app.waitFor(
          () => server.storyLikes.contains(StoryFixtures.verseSlug),
          reason: 'the like to reach the API');
      viewer.controller.pause(StoryPause.hold);
      await app.tapKey(like);
      expect(app.stories.isLiked(StoryFixtures.verseSlug), isFalse);
      await app.waitFor(
          () => !server.storyLikes.contains(StoryFixtures.verseSlug),
          reason: 'the unlike to reach the API');
    });

    storyTest(
        'a teaser video plays after its poster and quiets the radio; '
        'swiping up opens YouTube, on the web without the app', (app) async {
      final since = await app.tapStation(Stations.alpha);
      await app.expectPlaying(Stations.alpha, since: since);
      server.stories.add(StoryFixtures.teaser(base()));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.teaserSlug);
      final viewer = await app.waitForStory(StoryFixtures.teaserSlug);
      await app.waitFor(() => viewer.controller.progress > 0.1,
          reason: 'the video to play and fill its bar; '
              '${app.describeStories()}');
      await app.waitFor(() => app.audio.player.volume < 0.05,
          reason: 'the radio to step back under the video\'s sound');
      await app.waitFor(
          () => viewer.controller.ctaPhase != StoryCtaPhase.hidden,
          reason: 'the CTA to come in at 30% of the video; '
              '${app.describeStories()}');
      await app.pumpFor(StoryCtaReveal.riseDuration);
      expect(app.showsText(StoryFixtures.teaserCta), isTrue,
          reason: 'the CTA button');
      expect(app.findsKey('story-swipe-up'), isTrue,
          reason: 'the swipe-up hint');

      final launcher = RecordingLauncher()..appInstalled = false;
      final systemLauncher = UrlLauncherPlatform.instance;
      UrlLauncherPlatform.instance = launcher;
      try {
        final size =
            app.tester.view.physicalSize / app.tester.view.devicePixelRatio;
        await app.tester.timedDragFrom(
            Offset(size.width / 2, size.height * 0.6),
            const Offset(0, -300),
            const Duration(milliseconds: 300));
        await app.waitFor(() => launcher.launches.length >= 2,
            reason: 'YouTube to open, then the web');
        expect(launcher.launches.map((l) => '${l.url} ${l.mode.name}'), [
          '${StoryFixtures.youtubeUrl} externalNonBrowserApplication',
          '${StoryFixtures.youtubeUrl} externalApplication',
        ]);
      } finally {
        UrlLauncherPlatform.instance = systemLauncher;
      }
      expect(viewer.controller.pauses, contains(StoryPause.cta),
          reason: 'the story waits while YouTube is open');
      await app.waitFor(
          () => server.storyEventsOf('cta_click').isNotEmpty,
          reason: 'the CTA tap to reach the API');
      expect(server.storyEventsOf('cta_click').single['target'], 'swipe_up');

      // YouTube takes the screen: the video waits where it was, and goes on
      // from there on the way back.
      final left = viewer.controller.progress;
      app.goToBackground();
      await Future<void>.delayed(const Duration(seconds: 3));
      await app.comeBack();
      expect(viewer.controller.progress, closeTo(left, 0.1),
          reason: 'the video waited; ${app.describeStories()}');
      await app.waitFor(
          () =>
              !viewer.controller.isPaused &&
              viewer.controller.progress > left + 0.05,
          reason: 'the video to go on from where it was; '
              '${app.describeStories()}');

      await app.closeStoryViewer();
      await app.waitFor(() => app.audio.player.volume > 0.95,
          reason: 'the radio back at its volume');
      await app.expectAudioAdvances(const Duration(seconds: 3));
    });

    storyTest(
        'the CTA button to a station closes the viewer and plays it',
        (app) async {
      server.stories.add(StoryFixtures.verse(base()));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      final viewer = await app.waitForStory(StoryFixtures.verseSlug);
      viewer.controller.next();
      await app.waitForStory(StoryFixtures.verseSlug);
      // The bar comes in after 30% of the 4 s slide's play, its colour a
      // second later.
      expect(app.showsText(StoryFixtures.stationCta), isFalse,
          reason: 'the CTA waits for its time; ${app.describeStories()}');
      expect(app.findsKey('story-swipe-up'), isFalse);
      await app.waitFor(
          () => viewer.controller.ctaPhase == StoryCtaPhase.filled,
          reason: 'the CTA to come in; ${app.describeStories()}');
      await app.pumpFor(StoryCtaBar.fillDuration);
      expect(find.text(StoryFixtures.stationCta), findsOneWidget,
          reason: 'the CTA bar; ${app.describeStories()}');
      final since = DateTime.now();
      await app.tapText(StoryFixtures.stationCta);
      await app.waitFor(() => app.storyViewer == null,
          reason: 'the viewer to close');
      await app.expectPlaying(Stations.alpha, since: since);
    });

    storyTest(
        'an Instagram post shows in its embed; when the embed fails, its '
        'picture, author and caption, with Open in Instagram', (app) async {
      server.stories.add(StoryFixtures.instagram(base()));
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.instagramSlug);
      await app.waitForStory(StoryFixtures.instagramSlug);
      expect(find.byKey(const ValueKey('story-instagram-embed')),
          findsOneWidget, reason: 'the embed loaded');
      await app.closeStoryViewer();

      server.stories
        ..clear()
        ..add(StoryFixtures.instagram(base(), loads: false));
      await _forgetStories(app);
      await app.tapStoryBubble(StoryFixtures.instagramSlug);
      final viewer = await app.waitForStory(StoryFixtures.instagramSlug);
      viewer.controller.pause(StoryPause.hold);
      await app.pumpFor(const Duration(milliseconds: 300));
      viewer.controller.resume(StoryPause.hold);
      await app.waitFor(() => app.showsText('@radiocrestin'),
          reason: 'the author, from the stored details');
      expect(app.showsText(StoryFixtures.instagramCaption), isTrue);
      final launcher = RecordingLauncher();
      final systemLauncher = UrlLauncherPlatform.instance;
      UrlLauncherPlatform.instance = launcher;
      try {
        await app.waitFor(
            () => viewer.controller.ctaPhase != StoryCtaPhase.hidden,
            reason: 'Open in Instagram to come in at 30% of the slide; '
                '${app.describeStories()}');
        await app.pumpFor(StoryCtaReveal.riseDuration);
        await app.tapText('Deschide în Instagram');
        await app.waitFor(() => launcher.launches.isNotEmpty,
            reason: 'Instagram to open');
        expect(launcher.launches.first.url, StoryFixtures.instagramUrl);
        expect(launcher.launches.first.mode,
            PreferredLaunchMode.externalNonBrowserApplication,
            reason: 'the Instagram app, when installed');
      } finally {
        UrlLauncherPlatform.instance = systemLauncher;
      }
    });

    storyTest(
        'a due story opens by itself once per app open, takes turns with '
        'the cards, comes back after its actions and leaves after max '
        'shows', (app) async {
      server.stories
          .add(StoryFixtures.autoOpen(base(), everyActions: 2, maxShows: 2));
      await app.coldStartStories();
      await app.waitForStory(StoryFixtures.autoSlug);
      await app.waitFor(() => server.storyEventsOf('auto_open').isNotEmpty,
          reason: 'the auto-open to reach the API');
      await app.closeStoryViewer();

      Future<bool> opensAtLaunch() async {
        await app.coldStartStories();
        await app.pumpFor(const Duration(seconds: 3));
        final opened = app.storyViewer != null;
        await app.closeStoryViewer();
        return opened;
      }

      // One action since its show (this app open): not due yet.
      expect(await opensAtLaunch(), isFalse, reason: 'one action since');
      // Due now, but a card would be next: the cards' gap holds it.
      expect(await opensAtLaunch(), isFalse,
          reason: 'the home cards\' gap since it closed');
      await _countReviewActions(HomePromoSlot.gapActions);
      expect(await opensAtLaunch(), isTrue,
          reason: 'due again, the gap passed; ${app.describeStories()}');
      await app.coldStartStories();
      expect(app.storyBar, isEmpty,
          reason: 'two shows: it left the bar');
    });

    storyTest('the viewer works sideways, on a phone held landscape',
        (app) async {
      // Its tallest bottom: the CTA bar, the caption and the comment field.
      server
        ..stories.add(StoryFixtures.verse(base(), comments: true))
        ..storyCommentProfile = {'name': 'Ana', 'avatar_url': null};
      await app.coldStartStories();
      await app.tapStoryBubble(StoryFixtures.verseSlug);
      final view = app.tester.view;
      final upright = view.physicalSize;
      view.physicalSize = Size(upright.height, upright.width);
      try {
        await app.waitForStory(StoryFixtures.verseSlug);
        await app.pumpFor(const Duration(seconds: 1));
        expect(app.findsKey('story-close'), isTrue);
        expect(app.findsKey('story-like-${StoryFixtures.verseSlug}'), isTrue);
        app.storyViewer!.controller.next();
        await app.waitForStory(StoryFixtures.verseSlug);
        await app.waitFor(
            () => app.storyViewer!.controller.ctaPhase !=
                StoryCtaPhase.hidden,
            reason: 'the CTA to come in');
        await app.pumpFor(StoryCtaReveal.riseDuration);
        expect(app.findsKey('story-comment-field'), isTrue);
        expect(app.showsText(StoryFixtures.stationCta), isTrue);
        expect(app.tester.takeException(), isNull, reason: 'no overflow');
      } finally {
        view.physicalSize = upright;
        await app.pumpFor(const Duration(milliseconds: 500));
      }
    });
  });

  group('Settings', () {
    test("the contact button opens the website's contact page, with the "
        "app's details", (app) async {
      final launcher = RecordingLauncher();
      final systemLauncher = UrlLauncherPlatform.instance;
      UrlLauncherPlatform.instance = launcher;
      try {
        await app.openSettings();
        await app.tapSetting('Contactează-ne');
        await app.waitFor(() => launcher.launches.isNotEmpty,
            reason: 'the contact page to open');
        final page = Uri.parse(launcher.launches.single.url);
        expect(page.host, 'www.radiocrestin.ro');
        expect(page.path, '/contact/');
        expect(page.queryParameters['source'], 'app');
        expect(page.queryParameters['platform'],
            Platform.isIOS ? 'ios' : 'android');
        expect(page.queryParameters['app_version'], isNotEmpty);
        expect(launcher.launches.single.mode,
            PreferredLaunchMode.externalApplication);
      } finally {
        UrlLauncherPlatform.instance = systemLauncher;
      }
    });
  });

  group('Playlist stations', () {
    test('a YouTube playlist item loads the whole playlist', (app) async {
      await app.tapStation(Stations.youtubePlaylist);
      await app.waitFor(
          () =>
              app.audio.currentStation.valueOrNull?.slug ==
              Stations.youtubePlaylist.slug,
          reason: 'the playlist station to start');
      await app.openFullPlayer();
      final player = find.byType(YoutubePlayer);
      await app.waitFor(() => player.evaluate().isNotEmpty,
          reason: 'the YouTube player in the full player');
      final youtube = app.tester.widget<YoutubePlayer>(player).controller;

      // A player given the list ID as an array stays blank, with no videos.
      var videos = <String>[];
      final end = DateTime.now().add(const Duration(seconds: 45));
      while (videos.isEmpty && DateTime.now().isBefore(end)) {
        await app.pumpFor(const Duration(seconds: 1));
        try {
          videos = await youtube.playlist;
        } on ArgumentError {
          // Not loaded yet: the player answers null.
        }
      }
      expect(videos, isNotEmpty,
          reason: "the player holds the playlist's videos");
    });
  });

  // Last: it leaves the app in the background, where the tests above could
  // not drive it. Android doesn't let an app bring itself back.
  group('Leaving the app', () {
    test('BACK on Home leaves the station playing in the background',
        skip: !Platform.isAndroid, (app) async {
      await app.expectPlaying(Stations.alpha,
          since: await app.tapStation(Stations.alpha));

      final leftAt = await app.pressBack();
      await app.expectAudioAdvances(const Duration(seconds: 8));
      expect(
          server.mediaBytesSent(Stations.alpha, since: leftAt), greaterThan(0),
          reason: 'the stream kept coming in the background');
      expect(app.lifecycle, AppLifecycleState.paused,
          reason: 'the app waits in the background, not closed');
    });
  });
}

/// The device counts of a shared case (absent: 0, not closed).
AnnouncementCounts _countsFromCase(Map counts) => AnnouncementCounts(
      impressions: counts['impressions'] as int? ?? 0,
      clicks: counts['clicks'] as int? ?? 0,
      impressionsAfterClicks: counts['impressions_after_clicks'] as int? ?? 0,
      dismissed: counts['dismissed'] as bool? ?? false,
      started: counts['started'] as bool? ?? false,
      returns: counts['returns'] as int? ?? 0,
      waited: counts['waited'] as int? ?? 0,
    );

/// Forgets every announcement the device kept or was told, as a fresh
/// install, and starts the announcements anew.
Future<void> _forgetAnnouncements(RadioApp app) async {
  final prefs = await SharedPreferences.getInstance();
  for (final key in prefs.getKeys().toList()) {
    if (key.startsWith('announcements_')) await prefs.remove(key);
  }
  await app.coldStartAnnouncements();
}

/// Taps the first [text] inside the rich text under [within], as a finger
/// on those words does.
Future<void> tapText(RadioApp app, Finder within, String text) async {
  final richText = find.descendant(of: within, matching: find.byType(RichText));
  final paragraph = app.tester.renderObject<RenderParagraph>(richText.first);
  final start = paragraph.text.toPlainText().indexOf(text);
  expect(start, greaterThanOrEqualTo(0), reason: '"$text" in the text');
  final box = paragraph
      .getBoxesForSelection(
          TextSelection(baseOffset: start, extentOffset: start + text.length))
      .first;
  await app.tester.tapAt(paragraph.localToGlobal(box.toRect().center));
  await app.tester.pump();
}

/// Forgets what the device kept about stories (and when the last home
/// card closed), then starts their service again: a device that never saw
/// one.
Future<void> _forgetStories(RadioApp app) async {
  final prefs = await SharedPreferences.getInstance();
  for (final key in prefs.getKeys().toList()) {
    if (key.startsWith('stories_')) await prefs.remove(key);
  }
  await prefs.remove('promo_card_closed_at_actions');
  await app.coldStartStories();
}

/// Counts [count] more of the actions the home cards wait for.
Future<void> _countReviewActions(int count) async {
  final prefs = await SharedPreferences.getInstance();
  final status = jsonDecode(prefs.getString('_reviewStatus') ?? '{}') as Map;
  status['actions_made'] = (status['actions_made'] as int? ?? 0) + count;
  await prefs.setString('_reviewStatus', jsonEncode(status));
}
