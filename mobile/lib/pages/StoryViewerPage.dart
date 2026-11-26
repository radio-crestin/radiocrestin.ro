import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:get_it/get_it.dart';

import '../appAudioHandler.dart';
import '../services/announcement.dart';
import '../services/announcement_actions.dart';
import '../services/announcement_copy.dart';
import '../services/stories_service.dart';
import '../services/story.dart';
import '../services/story_cta.dart';
import '../services/story_viewer_controller.dart';
import '../theme.dart';
import '../widgets/bottom_toast.dart';
import '../widgets/share_handler.dart';
import '../widgets/story_comments.dart';
import '../widgets/story_overlay.dart';
import '../widgets/story_slide_view.dart';

/// The full-screen story viewer: one story after the other, each slide
/// with its bar at the top.
///
/// Tap the right two thirds for the next slide and the left third for the
/// previous one; hold to pause; swipe sideways for the next or previous
/// story; swipe down to close; swipe up for the slide's call to action.
/// Works upright and sideways, on phones and tablets.
///
/// Closes with the in-app page a call to action asked for (a station, a
/// song, …), which its opener then shows.
class StoryViewerPage extends StatefulWidget {
  const StoryViewerPage({
    super.key,
    required this.stories,
    this.initialStory = 0,
    this.autoOpened = false,
  });

  final List<Story> stories;
  final int initialStory;

  /// The app opened it by itself (its display rules), not a tap.
  final bool autoOpened;

  /// Opens the viewer over the app; its future gives the page of the app a
  /// call to action asked for, or null.
  ///
  /// With [from] (a bubble's circle on the screen) it grows out of the
  /// bubble and shrinks back into it, as Instagram's stories do;
  /// otherwise (a link, opening by itself) it slides up.
  static Future<StoryCtaTarget?> open(
    BuildContext context, {
    required List<Story> stories,
    int initialStory = 0,
    bool autoOpened = false,
    Rect? from,
  }) =>
      Navigator.of(context).push<StoryCtaTarget>(PageRouteBuilder(
        opaque: false,
        settings: const RouteSettings(name: 'story_viewer'),
        transitionDuration: const Duration(milliseconds: 300),
        reverseTransitionDuration: const Duration(milliseconds: 250),
        pageBuilder: (context, animation, secondary) => StoryViewerPage(
          stories: stories,
          initialStory: initialStory,
          autoOpened: autoOpened,
        ),
        transitionsBuilder: (context, animation, secondary, child) {
          if (from != null && !from.isEmpty) {
            return _GrowFromBubble(
                animation: animation, from: from, child: child);
          }
          return SlideTransition(
            position: Tween(begin: const Offset(0, 1), end: Offset.zero)
                .animate(CurvedAnimation(
              parent: animation,
              curve: Curves.fastOutSlowIn,
              reverseCurve: Curves.easeInOut,
            )),
            child: child,
          );
        },
      ));

  @override
  State<StoryViewerPage> createState() => StoryViewerPageState();
}

/// The viewer's state; public so the e2e tests can read where it is.
class StoryViewerPageState extends State<StoryViewerPage>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final StoryViewerController controller;
  late final PageController _pages;
  late final Ticker _ticker;
  final StoriesService _service = GetIt.instance<StoriesService>();
  Duration _lastTick = Duration.zero;

  /// Whether story videos play without sound; kept for this app run.
  static bool _muted = false;
  bool get muted => _muted;

  bool _sounding = false;
  bool _closing = false;
  bool _autoShowRecorded = false;

  /// How far the listener dragged the viewer down to close it.
  double _drag = 0;

  /// A drag up that may become the call to action.
  double _dragUp = 0;

  /// What the page shows changes only with these; the bars follow the
  /// controller on their own.
  (int, int, bool, Set<StoryPause>, StoryCtaPhase)? _shown;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller = StoryViewerController(
      stories: widget.stories,
      initialStory: widget.initialStory,
      onStoryShown: _onStoryShown,
      onSlideShown: _onSlideShown,
      onStoryCompleted: (story) => _service.report(StoryEvent.complete, story),
      onFinished: () => _close(),
    )..addListener(_onController);
    _pages = PageController(initialPage: controller.storyIndex);
    _ticker = createTicker(_onTick)..start();
    controller.start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _ticker.dispose();
    _commentFocus.dispose();
    controller.removeListener(_onController);
    controller.dispose();
    _pages.dispose();
    _duck(false);
    _service.viewerClosed();
    unawaited(_service.flush());
    super.dispose();
  }

  void _onTick(Duration elapsed) {
    final step = elapsed - _lastTick;
    _lastTick = elapsed;
    controller.tick(step);
  }

  void _onStoryShown(Story story) {
    final auto = widget.autoOpened && !_autoShowRecorded;
    _autoShowRecorded = true;
    unawaited(_service.recordShow(story, auto: auto));
    unawaited(_service.loadCommentAccess(story));
  }

  void _onSlideShown(Story story, StorySlide slide) {
    // The slide's timer waits for its media.
    controller.pause(StoryPause.loading);
    _setSounding(false);
    unawaited(_service.recordSlideView(story, slide));
  }

  void _onController() {
    if (!mounted) return;
    final shown = (
      controller.storyIndex,
      controller.slideIndex,
      controller.isFinished,
      controller.pauses,
      controller.ctaPhase,
    );
    final before = _shown;
    if (before != null &&
        before.$1 == shown.$1 &&
        before.$2 == shown.$2 &&
        before.$3 == shown.$3 &&
        _sameSet(before.$4, shown.$4) &&
        before.$5 == shown.$5) {
      return;
    }
    _shown = shown;
    if (_pages.hasClients &&
        (_pages.page ?? 0).round() != controller.storyIndex) {
      unawaited(_pages.animateToPage(
        controller.storyIndex,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      ));
    }
    setState(() {});
  }

  static bool _sameSet(Set<StoryPause> a, Set<StoryPause> b) =>
      a.length == b.length && a.containsAll(b);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        controller.resume(StoryPause.background);
        // Back from what a call to action opened. A resume before the app
        // was left doesn't count: iOS reports one while it hands a link
        // to an app, before that app (or the browser) takes the screen.
        if (_ctaLeftApp) {
          _ctaLeftApp = false;
          controller.resume(StoryPause.cta);
        }
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        controller.pause(StoryPause.background);
        if (controller.pauses.contains(StoryPause.cta)) _ctaLeftApp = true;
      default:
        break;
    }
  }

  /// Whether the app was left while a call to action held the story.
  bool _ctaLeftApp = false;

  /// The comment field's focus: the story waits while the listener
  /// writes.
  late final FocusNode _commentFocus = FocusNode()
    ..addListener(() => _commentFocus.hasFocus
        ? controller.pause(StoryPause.comment)
        : controller.resume(StoryPause.comment));

  /// Posts [text] as a public comment from the slide on screen; the field
  /// says how it went, over the story, without a dialog.
  Future<StoryCommentResult> _postComment(String text) async {
    final (result, _) =
        await _service.postComment(controller.story, controller.slide, text);
    return result;
  }

  /// The story's comments in a sheet; the story waits while it is open.
  Future<void> openComments() async {
    controller.pause(StoryPause.sheet);
    try {
      await StoryCommentsSheet.show(
        context,
        story: controller.story,
        slide: controller.slide,
        service: _service,
      );
    } finally {
      if (mounted) controller.resume(StoryPause.sheet);
    }
  }

  // ── Sound ──────────────────────────────────────────────────────────────

  void _setSounding(bool sounding) {
    if (_sounding == sounding) return;
    _sounding = sounding;
    _duck(sounding);
  }

  static void _duck(bool ducked) {
    final getIt = GetIt.instance;
    if (!getIt.isRegistered<AppAudioHandler>()) return;
    unawaited(getIt<AppAudioHandler>().duckForStory(ducked));
  }

  void toggleMute() => setState(() => _muted = !_muted);

  // ── Closing ────────────────────────────────────────────────────────────

  void _close([StoryCtaTarget? openAfter]) {
    if (_closing || !mounted) return;
    _closing = true;
    _ticker.stop();
    _setSounding(false);
    Navigator.of(context).pop(openAfter);
  }

  void close() => _close();

  // ── Gestures ───────────────────────────────────────────────────────────

  /// A tap goes on or back; a story paused for a call to action (back
  /// from an in-app browser) goes on where it was instead.
  void _onTap(bool forward) {
    // A tap beside the comment field puts the keyboard away.
    if (_commentFocus.hasFocus) {
      _commentFocus.unfocus();
      return;
    }
    if (controller.pauses.contains(StoryPause.cta)) {
      controller.resume(StoryPause.cta);
      return;
    }
    forward ? controller.next() : controller.previous();
  }

  /// A sideways swipe holds the story while the finger turns it; turning
  /// by itself (a story's end) doesn't.
  bool _onTurn(ScrollNotification notification) {
    if (notification.depth != 0) return false;
    if (notification is ScrollStartNotification &&
        notification.dragDetails != null) {
      controller.pause(StoryPause.turn);
    } else if (notification is ScrollEndNotification) {
      controller.resume(StoryPause.turn);
    }
    return false;
  }

  void _onVerticalDragStart(DragStartDetails details) {
    _dragUp = 0;
    controller.pause(StoryPause.drag);
  }

  void _onVerticalDragUpdate(DragUpdateDetails details) {
    final dy = details.primaryDelta ?? 0;
    if (_drag > 0 || dy > 0 && _dragUp == 0) {
      setState(() => _drag = (_drag + dy).clamp(0, double.infinity));
    } else {
      _dragUp -= dy;
    }
  }

  void _onVerticalDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (_drag > 0) {
      if (_drag > 120 || velocity > 700) return _close();
      setState(() => _drag = 0);
    } else if (_dragUp > 60 || velocity < -600) {
      final cta = controller.slide.effectiveCta;
      // Only once it shows: a call to action not yet in doesn't run.
      if (cta != null &&
          cta.style.hasSwipeUp &&
          controller.ctaPhase != StoryCtaPhase.hidden) {
        unawaited(runCta(cta, via: 'swipe_up'));
      }
    }
    _dragUp = 0;
    controller.resume(StoryPause.drag);
  }

  void _onVerticalDragCancel() {
    setState(() => _drag = 0);
    _dragUp = 0;
    controller.resume(StoryPause.drag);
  }

  // ── Like, share, call to action ────────────────────────────────────────

  Future<void> share() async {
    final story = controller.story;
    controller.pause(StoryPause.sheet);
    _service.report(StoryEvent.share, story);
    try {
      await ShareHandler.shareViaSystem(
        shareUrl: story.shareUrl ?? 'https://www.radiocrestin.ro/',
        shareMessage: story.title,
        sharePositionOrigin: _screenCenter(),
      );
    } finally {
      controller.resume(StoryPause.sheet);
    }
  }

  Rect _screenCenter() {
    final size = MediaQuery.sizeOf(context);
    return Rect.fromCenter(
        center: size.center(Offset.zero), width: 1, height: 1);
  }

  /// Runs [cta] of the current slide, tapped ([via] `button`) or swiped
  /// up (`swipe_up`), and records it.
  Future<void> runCta(StoryCta cta, {required String via}) async {
    final story = controller.story;
    _service.report(StoryEvent.ctaClick, story,
        slide: controller.slide, target: via);
    final target = cta.target;
    switch (StoryCtaRouter.plan(target)) {
      case StoryCtaPlan.leaveApp:
        await _leaveApp(target);
      case StoryCtaPlan.closeThenOpen:
        _close(target);
      case StoryCtaPlan.sheet:
        controller.pause(StoryPause.sheet);
        try {
          await AnnouncementActions.share(AnnouncementAction(
            type: AnnouncementActionType.share,
            shareText: target.shareText,
          ));
        } finally {
          controller.resume(StoryPause.sheet);
        }
      case StoryCtaPlan.showStory:
        await _showStory(target.storySlug!);
    }
  }

  Future<void> _leaveApp(StoryCtaTarget target) async {
    controller.pause(StoryPause.cta);
    _setSounding(false);
    if (await StoryCtaRouter.leaveApp(target)) return;
    controller.resume(StoryPause.cta);
    if (!mounted) return;
    showBottomToast(
      context,
      title: AnnouncementCopy.linkFailed,
      message: AnnouncementCopy.linkFailedHint,
      icon: Icons.link_off_rounded,
      isError: true,
    );
  }

  Future<void> _showStory(String slug) async {
    controller.pause(StoryPause.loading);
    final story = await _service.find(slug);
    if (!mounted) return;
    if (story == null) {
      controller.resume(StoryPause.loading);
      return;
    }
    controller.showOtherStory(story);
  }

  /// A link tapped inside an embed: opened in its app or the browser.
  void _openEmbedLink(Uri uri) => unawaited(_leaveApp(StoryCtaTarget(
        type: StoryCtaTargetType.appLink,
        appUrl: uri.toString(),
        fallbackUrl: uri.toString(),
      )));

  // ── Layout ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height;
    final dragged = (_drag / height).clamp(0.0, 1.0);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: ColoredBox(
        // The app shows through as the viewer is dragged down.
        color: Colors.black.withValues(alpha: 1 - dragged),
        child: Transform.translate(
          offset: Offset(0, _drag),
          child: Transform.scale(
            scale: 1 - dragged * 0.15,
            child: GestureDetector(
              onVerticalDragStart: _onVerticalDragStart,
              onVerticalDragUpdate: _onVerticalDragUpdate,
              onVerticalDragEnd: _onVerticalDragEnd,
              onVerticalDragCancel: _onVerticalDragCancel,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(dragged > 0 ? 16 : 0),
                child: Material(
                  color: Colors.black,
                  child: NotificationListener<ScrollNotification>(
                    onNotification: _onTurn,
                    child: PageView.builder(
                      controller: _pages,
                      itemCount: controller.stories.length,
                      onPageChanged: (index) {
                        if (index != controller.storyIndex) {
                          controller.showStory(index);
                        }
                      },
                      itemBuilder: (context, index) => _CubeFace(
                        pages: _pages,
                        index: index,
                        current: controller.storyIndex,
                        child: index == controller.storyIndex
                            ? _activeStory(context)
                            : _StoryCover(story: controller.stories[index]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _activeStory(BuildContext context) {
    final story = controller.story;
    final slide = controller.slide;
    final holding = controller.pauses.contains(StoryPause.hold);
    final cta = slide.effectiveCta;
    final embed = slide.type == StorySlideType.instagram &&
        slide.instagram?.mediaUrl == null;
    return LayoutBuilder(
      builder: (context, box) => Stack(
        fit: StackFit.expand,
        children: [
          StorySlideView(
            key: ValueKey('story-slide-${story.slug}-${slide.id}'),
            slide: slide,
            controller: controller,
            paused: controller.isPaused &&
                !controller.pauses.every((p) => p == StoryPause.loading),
            muted: _muted,
            events: StorySlideEvents(
              onReady: () => controller.resume(StoryPause.loading),
              onFailed: () => controller.resume(StoryPause.loading),
              onSound: _setSounding,
              onInteract: () => controller.pause(StoryPause.embed),
              onOpenLink: _openEmbedLink,
            ),
          ),
          const _Shade(),
          _TapZones(
            edgesOnly: embed,
            width: box.maxWidth,
            onTap: _onTap,
            onHold: () => controller.pause(StoryPause.hold),
            onRelease: () => controller.resume(StoryPause.hold),
          ),
          SafeArea(
            child: AnimatedOpacity(
              opacity: holding ? 0 : 1,
              duration: const Duration(milliseconds: 200),
              child: Column(
                children: [
                  _Header(
                    controller: controller,
                    story: story,
                    showMute: slide.ducksRadio,
                    muted: _muted,
                    onMute: toggleMute,
                    onClose: _close,
                  ),
                  const Spacer(),
                  if (controller.pauses.contains(StoryPause.cta))
                    const _PausedBadge(),
                  const Spacer(),
                  _Bottom(
                    key: ValueKey('story-bottom-${story.slug}-${slide.id}'),
                    story: story,
                    slide: slide,
                    cta: cta,
                    ctaPhase: controller.ctaPhase,
                    service: _service,
                    commentFocus: _commentFocus,
                    onCta: (via) => runCta(cta!, via: via),
                    onShare: share,
                    onPostComment: _postComment,
                    onOpenComments: openComments,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A story next to the one playing, as a sideways swipe shows it: its
/// cover, dimmed.
class _StoryCover extends StatelessWidget {
  const _StoryCover({required this.story});

  final Story story;

  @override
  Widget build(BuildContext context) {
    final url = story.bubbleImageUrl;
    return ColoredBox(
      color: AppColors.storyBackdrop,
      child: url == null ? null : StoryImage(url: url, fit: BoxFit.cover),
    );
  }
}

/// Darkens the top and bottom edges, so the bars and buttons read on any
/// picture.
class _Shade extends StatelessWidget {
  const _Shade();

  @override
  Widget build(BuildContext context) => const IgnorePointer(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0x73000000),
                Color(0x00000000),
                Color(0x00000000),
                Color(0x8c000000),
              ],
              stops: [0, 0.18, 0.7, 1],
            ),
          ),
        ),
      );
}

/// Where taps and holds move the story: the whole slide (its left third
/// goes back), or only its edges when an embed takes the touches in its
/// middle.
class _TapZones extends StatelessWidget {
  const _TapZones({
    required this.edgesOnly,
    required this.width,
    required this.onTap,
    required this.onHold,
    required this.onRelease,
  });

  final bool edgesOnly;
  final double width;

  /// A tap, going on ([forward]) or back.
  final ValueChanged<bool> onTap;
  final VoidCallback onHold;
  final VoidCallback onRelease;

  static const _edge = 0.18;

  Widget _zone({
    double? left,
    double? right,
    double? zoneWidth,
    required bool Function(TapUpDetails details) forward,
  }) =>
      Positioned(
        left: left,
        right: right,
        top: 0,
        bottom: 0,
        width: zoneWidth,
        child: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTapUp: (details) => onTap(forward(details)),
          onLongPressStart: (_) => onHold(),
          onLongPressEnd: (_) => onRelease(),
          onLongPressCancel: onRelease,
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      if (!edgesOnly)
        _zone(
          left: 0,
          right: 0,
          forward: (details) => details.localPosition.dx >= width / 3,
        )
      else ...[
        _zone(left: 0, zoneWidth: width * _edge, forward: (_) => false),
        _zone(right: 0, zoneWidth: width * _edge, forward: (_) => true),
      ],
    ]);
  }
}

/// The slides' bars, the story's picture and title, and the mute and close
/// buttons.
class _Header extends StatelessWidget {
  const _Header({
    required this.controller,
    required this.story,
    required this.showMute,
    required this.muted,
    required this.onMute,
    required this.onClose,
  });

  final StoryViewerController controller;
  final Story story;
  final bool showMute;
  final bool muted;
  final VoidCallback onMute;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 4, 0),
      child: Column(
        children: [
          ListenableBuilder(
            listenable: controller,
            builder: (context, _) => _ProgressBars(
              count: story.slides.length,
              progressOf: controller.barProgress,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Spacer(),
              if (showMute)
                _ChromeButton(
                  key: const ValueKey('story-mute'),
                  icon: muted
                      ? Icons.volume_off_rounded
                      : Icons.volume_up_rounded,
                  tooltip: muted ? 'Pornește sunetul' : 'Oprește sunetul',
                  onPressed: onMute,
                ),
              _ChromeButton(
                key: const ValueKey('story-close'),
                icon: Icons.close_rounded,
                tooltip: 'Închide',
                onPressed: onClose,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProgressBars extends StatelessWidget {
  const _ProgressBars({required this.count, required this.progressOf});

  final int count;
  final double Function(int index) progressOf;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < count; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: SizedBox(
                height: 2.5,
                child: LinearProgressIndicator(
                  value: progressOf(i),
                  backgroundColor: Colors.white38,
                  color: Colors.white,
                  minHeight: 2.5,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _ChromeButton extends StatelessWidget {
  const _ChromeButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
        icon: Icon(icon,
            color: Colors.white,
            size: 26,
            shadows: const [Shadow(blurRadius: 4, color: Colors.black45)]),
        tooltip: tooltip,
        onPressed: onPressed,
      );
}

/// Shown while the story waits for the listener to come back from what a
/// call to action opened; a tap goes on.
class _PausedBadge extends StatelessWidget {
  const _PausedBadge();

  @override
  Widget build(BuildContext context) => const IgnorePointer(
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Color(0x66000000),
            shape: BoxShape.circle,
          ),
          child: Padding(
            padding: EdgeInsets.all(14),
            child:
                Icon(Icons.play_arrow_rounded, color: Colors.white, size: 40),
          ),
        ),
      );
}

/// A story as one face of a cube seen from outside, as Instagram's
/// stories turn: the edge two stories share comes towards the listener,
/// their far sides fall away, and the face turning away darkens.
///
/// The face keeps the same widgets at rest and while it turns, so a
/// video that plays doesn't start again when a swipe begins or stops.
class _CubeFace extends StatelessWidget {
  const _CubeFace({
    required this.pages,
    required this.index,
    required this.current,
    required this.child,
  });

  final PageController pages;
  final int index;
  final int current;
  final Widget child;

  /// How much nearer things look than far ones: Instagram's strong
  /// perspective, a face a quarter smaller at its far side half-turned.
  static const _perspective = 0.001;

  /// How dark a face gets as it turns edge-on.
  static const _shade = 0.55;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: pages,
      child: child,
      builder: (context, child) {
        final page = pages.hasClients && pages.position.haveDimensions
            ? pages.page ?? current.toDouble()
            : current.toDouble();
        final offset = (page - index).clamp(-1.0, 1.0);
        return Transform(
          // It turns about the edge it shares with its neighbour: its
          // right one as it leaves to the left, its left one as it comes.
          alignment: offset > 0 ? Alignment.centerRight : Alignment.centerLeft,
          transform: offset == 0
              ? Matrix4.identity()
              : (Matrix4.identity()
                ..setEntry(3, 2, _perspective)
                ..rotateY(offset * math.pi / 2)),
          child: DecoratedBox(
            position: DecorationPosition.foreground,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: offset.abs() * _shade),
            ),
            child: child,
          ),
        );
      },
    );
  }
}

/// The bottom of a slide, as Reels lays it out: the call to action and
/// who the story is from on the left, the actions on the right, then the
/// swipe-up hint and the public comment field at the bottom edge.
class _Bottom extends StatelessWidget {
  const _Bottom({
    super.key,
    required this.story,
    required this.slide,
    required this.cta,
    required this.ctaPhase,
    required this.service,
    required this.commentFocus,
    required this.onCta,
    required this.onShare,
    required this.onPostComment,
    required this.onOpenComments,
  });

  final Story story;
  final StorySlide slide;
  final StoryCta? cta;
  final StoryCtaPhase ctaPhase;
  final StoriesService service;
  final FocusNode commentFocus;
  final ValueChanged<String> onCta;
  final VoidCallback onShare;
  final Future<StoryCommentResult> Function(String text) onPostComment;
  final VoidCallback onOpenComments;

  /// The widest the call to action and the comment field get.
  static const double _maxWidth = 440;
  static const double _maxFieldWidth = 560;

  @override
  Widget build(BuildContext context) {
    final cta = this.cta;
    final comments = story.comments;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final compact = isCompactStory(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(12, 0, 8, 8 + keyboard),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                // On a wide screen (sideways, a tablet) it keeps a phone's
                // width, leaving the slide in view.
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: _maxWidth),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (cta != null && cta.style.hasButton)
                          // Its room opens when it comes in, pushing who
                          // the story is from up.
                          StoryCtaReveal(
                            shown: ctaPhase != StoryCtaPhase.hidden,
                            child: Padding(
                              padding:
                                  EdgeInsets.only(bottom: compact ? 8 : 14),
                              child: StoryCtaBar(
                                cta: cta,
                                filled: ctaPhase == StoryCtaPhase.filled,
                                onPressed: () => onCta('button'),
                              ),
                            ),
                          ),
                        StoryAuthorRow(story: story, slide: slide),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              StoryActionColumn(
                story: story,
                service: service,
                onComments: comments.enabled ? onOpenComments : null,
                onShare: onShare,
              ),
            ],
          ),
          if (cta != null && cta.style.hasSwipeUp)
            StoryCtaReveal(
              shown: ctaPhase != StoryCtaPhase.hidden,
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: StorySwipeUpHint(
                  label: cta.style.hasButton ? 'Glisează în sus' : cta.label,
                  onTap: () => onCta('swipe_up'),
                ),
              ),
            ),
          if (comments.enabled)
            // Only for a phone that may comment (a profile's, when only
            // profiles comment): it comes in once the API says so.
            StreamBuilder<Map<String, StoryCommentAccess>>(
              stream: service.commentAccess,
              builder: (context, _) {
                final access = service.commentAccessOf(story);
                final allowed = access?.canComment ?? false;
                return StoryCtaReveal(
                  shown: allowed,
                  child: Padding(
                    padding: EdgeInsets.only(top: compact ? 8 : 12),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: ConstrainedBox(
                        constraints:
                            const BoxConstraints(maxWidth: _maxFieldWidth),
                        child: StoryCommentField(
                          hint: comments.hint,
                          profile: access?.profile,
                          focusNode: commentFocus,
                          onSend: onPostComment,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

/// The viewer growing out of a bubble's circle ([from]) to the whole
/// screen, and back into it on the way out: scaled and moved, its corners
/// rounding as it shrinks. No fade, so the GPU draws it once a frame.
class _GrowFromBubble extends StatelessWidget {
  const _GrowFromBubble({
    required this.animation,
    required this.from,
    required this.child,
  });

  final Animation<double> animation;
  final Rect from;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    return AnimatedBuilder(
      animation: curved,
      child: child,
      builder: (context, child) {
        final t = curved.value;
        if (t >= 1) return child!;
        final size = MediaQuery.sizeOf(context);
        final scale = lerpDouble(from.width / size.width, 1, t)!;
        final center = Offset.lerp(from.center, size.center(Offset.zero), t)!;
        final shift = center - size.center(Offset.zero);
        return Transform(
          transform: Matrix4.translationValues(shift.dx, shift.dy, 0)
            ..multiply(Matrix4.diagonal3Values(scale, scale, 1)),
          alignment: Alignment.center,
          child: ClipRRect(
            borderRadius:
                BorderRadius.circular(lerpDouble(size.width / 2, 0, t)!),
            child: child,
          ),
        );
      },
    );
  }
}
