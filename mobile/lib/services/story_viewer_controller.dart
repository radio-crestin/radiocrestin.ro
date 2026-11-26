import 'package:flutter/foundation.dart';

import 'story.dart';

/// Why the viewer's timer stands still; it runs only when there is none.
enum StoryPause {
  /// The listener holds a finger on the screen.
  hold,

  /// The slide's media is still loading.
  loading,

  /// A call to action's target (an app, a page, the browser) is open.
  cta,

  /// The listener plays with an embed (YouTube, Instagram).
  embed,

  /// The app is in the background.
  background,

  /// A sheet is over the viewer (the share sheet).
  sheet,

  /// The listener drags the viewer down to close it.
  drag,

  /// The listener writes a public comment.
  comment,
}

/// How far a slide's call to action has come in.
enum StoryCtaPhase {
  /// Not yet: nothing shows, and a swipe up does nothing.
  hidden,

  /// In: the bar (glassy) and the swipe-up hint.
  shown,

  /// The bar's colour has swept in.
  filled,
}

/// When a slide's call to action comes in, as on the website's player
/// (`web/src/common/components/Story/StoryPlayer.tsx`): after 4 s of play,
/// or 30% of the slide when that is sooner; its colour a second later.
///
/// It counts play time: a pause or a hold stops it, and a video counts
/// its own position.
abstract final class StoryCtaTiming {
  static const showAfter = Duration(seconds: 4);
  static const maxShare = 0.3;
  static const fillDelay = Duration(seconds: 1);

  /// When a slide [length] long shows its call to action: 1.8 s for 6 s,
  /// 3 s for 10 s, 4 s from 13.3 s on.
  static Duration showAt(Duration length) {
    final share = length * maxShare;
    return share < showAfter ? share : showAfter;
  }

  /// The phase after [played] of a slide [length] long.
  static StoryCtaPhase phaseAt(Duration played, Duration length) {
    final at = showAt(length);
    if (played >= at + fillDelay) return StoryCtaPhase.filled;
    if (played >= at) return StoryCtaPhase.shown;
    return StoryCtaPhase.hidden;
  }
}

/// Where the viewer is and whether it runs: the story, the slide, how far
/// the slide's bar has filled, and why it is paused.
///
/// The widget ticks it ([tick]) with the time that passed; a slide whose
/// player sets the pace (a video) reports its position instead
/// ([playerProgress]) and ends it ([slideEnded]).
class StoryViewerController extends ChangeNotifier {
  StoryViewerController({
    required List<Story> stories,
    int initialStory = 0,
    this.onSlideShown,
    this.onStoryShown,
    this.onStoryCompleted,
    this.onFinished,
  })  : _stories = [...stories],
        _storyIndex = initialStory.clamp(0, stories.length - 1) {
    assert(stories.isNotEmpty);
  }

  final List<Story> _stories;
  int _storyIndex;
  int _slideIndex = 0;
  double _progress = 0;
  Duration? _playerDuration;
  final Set<StoryPause> _pauses = {};
  StoryCtaPhase _ctaPhase = StoryCtaPhase.hidden;
  bool _finished = false;
  bool _started = false;

  /// A slide came on screen.
  final void Function(Story story, StorySlide slide)? onSlideShown;

  /// A story came on screen.
  final void Function(Story story)? onStoryShown;

  /// The last slide of a story ran to its end.
  final void Function(Story story)? onStoryCompleted;

  /// The last story ended: the viewer closes.
  final VoidCallback? onFinished;

  List<Story> get stories => List.unmodifiable(_stories);
  int get storyIndex => _storyIndex;
  int get slideIndex => _slideIndex;
  Story get story => _stories[_storyIndex];
  StorySlide get slide => story.slides[_slideIndex];

  /// How far the current slide's bar has filled, from 0 to 1.
  double get progress => _progress;
  bool get isPaused => _pauses.isNotEmpty;
  Set<StoryPause> get pauses => Set.unmodifiable(_pauses);
  bool get isFinished => _finished;

  /// How long the current slide has played.
  Duration get played => slideDuration * _progress;

  /// How far the current slide's call to action has come in; it never
  /// goes back on the same slide.
  StoryCtaPhase get ctaPhase => _ctaPhase;

  /// How far bar [index] of the current story has filled.
  double barProgress(int index) => index < _slideIndex
      ? 1
      : index == _slideIndex
          ? _progress
          : 0;

  /// How long the current slide lasts: its player's length once known,
  /// else the API's.
  Duration get slideDuration => _playerDuration ?? slide.duration;

  /// Whether the current slide's player, not the timer, fills the bar.
  bool get _playerPaced => slide.type == StorySlideType.video ||
      (slide.instagram?.mediaIsVideo ?? false) &&
          slide.instagram?.mediaUrl != null;

  /// Reports the first story and slide; call once the viewer is shown.
  void start() {
    if (_started) return;
    _started = true;
    _announce(storyChanged: true);
  }

  /// Advances the timer by [elapsed]; at the slide's end, the next slide.
  void tick(Duration elapsed) {
    if (_finished || isPaused || _playerPaced) return;
    final total = slideDuration.inMicroseconds;
    if (total <= 0) return;
    _progress += elapsed.inMicroseconds / total;
    _updateCta();
    if (_progress >= 1) {
      next();
    } else {
      notifyListeners();
    }
  }

  /// The player of a paced slide is at [position] of [duration].
  void playerProgress(Duration position, Duration duration) {
    if (_finished || !_playerPaced || duration <= Duration.zero) return;
    _playerDuration = duration;
    _progress = (position.inMicroseconds / duration.inMicroseconds)
        .clamp(0.0, 1.0);
    _updateCta();
    notifyListeners();
  }

  /// The slide's player reached its end.
  void slideEnded() {
    if (!_finished) next();
  }

  void pause(StoryPause reason) {
    if (_pauses.add(reason)) notifyListeners();
  }

  void resume(StoryPause reason) {
    if (_pauses.remove(reason)) notifyListeners();
  }

  /// The next slide; after the last, the next story; after the last
  /// story, the end.
  void next() {
    if (_finished) return;
    if (_slideIndex < story.slides.length - 1) {
      _goTo(_storyIndex, _slideIndex + 1);
      return;
    }
    onStoryCompleted?.call(story);
    if (_storyIndex < _stories.length - 1) {
      _goTo(_storyIndex + 1, 0);
    } else {
      _finish();
    }
  }

  /// The previous slide; on the first, the previous story's start; on the
  /// very first, this slide again.
  void previous() {
    if (_finished) return;
    if (_slideIndex > 0) {
      _goTo(_storyIndex, _slideIndex - 1);
    } else if (_storyIndex > 0) {
      _goTo(_storyIndex - 1, 0);
    } else {
      _goTo(_storyIndex, 0);
    }
  }

  /// Jumps to the start of story [index] (a swipe, a CTA to a story).
  void showStory(int index) {
    if (_finished || index < 0 || index >= _stories.length) return;
    _goTo(index, 0);
  }

  /// Shows [other] (a CTA to a story): where it is in the viewer, or
  /// added after the current one.
  void showOtherStory(Story other) {
    if (_finished) return;
    var index = _stories.indexWhere((story) => story.slug == other.slug);
    if (index < 0) {
      index = _storyIndex + 1;
      _stories.insert(index, other);
    }
    _goTo(index, 0);
  }

  void nextStory() {
    if (_storyIndex < _stories.length - 1) {
      _goTo(_storyIndex + 1, 0);
    } else {
      _finish();
    }
  }

  void previousStory() => showStory(_storyIndex > 0 ? _storyIndex - 1 : 0);

  /// Ends the viewing (closed by the listener).
  void close() => _finish();

  void _goTo(int storyIndex, int slideIndex) {
    final storyChanged = storyIndex != _storyIndex;
    _storyIndex = storyIndex;
    _slideIndex = slideIndex;
    _progress = 0;
    _playerDuration = null;
    _ctaPhase = StoryCtaPhase.hidden;
    // A new slide loads afresh; what held the old one doesn't hold it.
    _pauses.removeAll(const {StoryPause.loading, StoryPause.embed});
    _announce(storyChanged: storyChanged);
  }

  void _updateCta() {
    final phase = StoryCtaTiming.phaseAt(played, slideDuration);
    if (phase.index > _ctaPhase.index) _ctaPhase = phase;
  }

  void _announce({required bool storyChanged}) {
    if (_started) {
      if (storyChanged) onStoryShown?.call(story);
      onSlideShown?.call(story, slide);
    }
    notifyListeners();
  }

  void _finish() {
    if (_finished) return;
    _finished = true;
    notifyListeners();
    onFinished?.call();
  }
}
