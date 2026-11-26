import 'dart:developer' as developer;
import 'dart:io' show Platform;

import 'package:android_intent_plus/android_intent.dart';
import 'package:url_launcher/url_launcher.dart';

import 'announcement_actions.dart';
import 'autoplay_hold.dart';
import 'story.dart';

/// What the viewer does with a call to action, before anything opens.
enum StoryCtaPlan {
  /// Another app or the browser opens over the app; the story waits
  /// paused, and goes on when the listener comes back.
  leaveApp,

  /// A page of this app: the viewer closes, then the page opens.
  closeThenOpen,

  /// A sheet opens over the viewer (sharing the app), which waits paused.
  sheet,

  /// The viewer jumps to another story.
  showStory,
}

/// Decides and runs what a story's call to action opens
/// (`backend/docs/stories-api.md`, "CTA").
///
/// Links follow the announcements' rules ([AnnouncementActions.safeLink]),
/// and an app's own scheme may open too, but never a scheme that runs or
/// reads something on the device.
class StoryCtaRouter {
  const StoryCtaRouter._();

  /// What [target] does to the viewer.
  static StoryCtaPlan plan(StoryCtaTarget target) => switch (target.type) {
        StoryCtaTargetType.url || StoryCtaTargetType.appLink =>
          StoryCtaPlan.leaveApp,
        StoryCtaTargetType.story => StoryCtaPlan.showStory,
        StoryCtaTargetType.inApp => target.route == StoryInAppRoute.share
            ? StoryCtaPlan.sheet
            : StoryCtaPlan.closeThenOpen,
      };

  static const _refusedSchemes = {
    'javascript',
    'data',
    'file',
    'vbscript',
    'about',
    'blob',
    'content',
    'intent',
  };

  /// [url] parsed when it may open an app: a safe web link, or an app's
  /// own scheme (`spotify:`, `youtube:`).
  static Uri? appLink(String? url) {
    final safe = AnnouncementActions.safeLink(url);
    if (safe != null) return safe;
    final uri = url == null ? null : Uri.tryParse(url.trim());
    if (uri == null || uri.scheme.isEmpty) return null;
    return _refusedSchemes.contains(uri.scheme.toLowerCase()) ? null : uri;
  }

  /// The order an app link is tried in, after the Android intent: the
  /// app's link (a web one only when its app is installed), then the
  /// fallback page (or the app's web link) in the browser.
  static List<(Uri, LaunchMode)> appLinkAttempts(StoryCtaTarget target) {
    final app = appLink(target.appUrl);
    final web = AnnouncementActions.safeLink(target.fallbackUrl) ??
        AnnouncementActions.safeLink(target.appUrl);
    final isWeb = app != null && (app.scheme == 'https' || app.scheme == 'http');
    return [
      if (app != null)
        // A web link opens only an installed app; an app's own scheme
        // opens it or fails.
        (app, isWeb ? LaunchMode.externalNonBrowserApplication
            : LaunchMode.externalApplication),
      if (web != null) (web, LaunchMode.externalApplication),
    ];
  }

  /// Opens a [StoryCtaPlan.leaveApp] target; false when nothing opened.
  static Future<bool> leaveApp(StoryCtaTarget target) async {
    // Coming back must not start the radio again (iOS autoplay on
    // resume): the listener left for something else.
    AutoplayHold.holdNextResume();
    final opened = switch (target.type) {
      StoryCtaTargetType.url => AnnouncementActions.openLink(
          target.url,
          target.inAppBrowser
              ? LaunchMode.inAppBrowserView
              : LaunchMode.externalApplication,
        ),
      _ => _openApp(target),
    };
    if (!await opened) AutoplayHold.release();
    return opened;
  }

  static Future<bool> _openApp(StoryCtaTarget target) async {
    final intent = target.androidIntentUri?.trim();
    if (Platform.isAndroid &&
        intent != null &&
        intent.toLowerCase().startsWith('intent:')) {
      try {
        await AndroidIntent.parseAndLaunch(intent);
        return true;
      } catch (e) {
        developer.log('Story: intent failed, trying the app link: $e');
      }
    }
    for (final (uri, mode) in appLinkAttempts(target)) {
      if (await _launch(uri, mode)) return true;
    }
    return false;
  }

  static Future<bool> _launch(Uri uri, LaunchMode mode) async {
    try {
      return await launchUrl(uri, mode: mode);
    } catch (e) {
      developer.log('Story: cannot open $uri ($mode): $e');
      return false;
    }
  }
}
