import 'package:flutter/material.dart';

import '../services/stories_service.dart';
import '../theme.dart';
import 'story_slide_view.dart';

/// The row of story bubbles at the top of the home screen: a round picture
/// with the story's title under it. Due stories come first, with a
/// coloured ring; the others have a grey one.
///
/// Grows in when the first stories arrive and shrinks away when the last
/// one goes.
class StoriesBar extends StatelessWidget {
  const StoriesBar({super.key, required this.bubbles, required this.onOpen});

  final List<StoryBubble> bubbles;

  /// A bubble was tapped: the viewer opens at bubble [index], growing out
  /// of its circle, [from] (on the screen).
  final void Function(int index, Rect from) onOpen;

  static const double bubbleSize = 68;

  /// The bar's height: the bubble and its title, with room above and
  /// below so the rings never touch the app bar or the list.
  static const double height = 122;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInOut,
      alignment: Alignment.topCenter,
      child: bubbles.isEmpty
          ? const SizedBox(width: double.infinity)
          : SizedBox(
              key: const ValueKey('stories-bar'),
              height: height,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                // The app's 16 px gutter, and air between the rings.
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                itemCount: bubbles.length,
                separatorBuilder: (context, index) => const SizedBox(width: 8),
                itemBuilder: (context, index) => _Bubble(
                  bubble: bubbles[index],
                  onTap: (from) => onOpen(index, from),
                ),
              ),
            ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.bubble, required this.onTap});

  final StoryBubble bubble;
  /// Tapped, with where its circle is on the screen.
  final ValueChanged<Rect> onTap;

  /// The circle's place on the screen, for the viewer to grow out of.
  static Rect _circleOf(BuildContext context) {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return Rect.zero;
    final topLeft = box.localToGlobal(Offset.zero);
    const size = StoriesBar.bubbleSize;
    return Rect.fromLTWH(
        topLeft.dx + (box.size.width - size) / 2, topLeft.dy, size, size);
  }

  @override
  Widget build(BuildContext context) {
    final story = bubble.story;
    final theme = Theme.of(context);
    final dark = theme.brightness == Brightness.dark;
    final image = story.bubbleImageUrl;
    const size = StoriesBar.bubbleSize;
    return Semantics(
      button: true,
      label: story.title,
      hint: bubble.highlighted ? 'Poveste nouă' : 'Poveste văzută',
      excludeSemantics: true,
      child: InkWell(
        key: ValueKey('story-bubble-${story.slug}'),
        onTap: () => onTap(_circleOf(context)),
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: size + 16,
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: size,
                height: size,
                padding: EdgeInsets.all(bubble.highlighted ? 2.5 : 1.5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: bubble.highlighted
                      ? const LinearGradient(
                          begin: Alignment.bottomLeft,
                          end: Alignment.topRight,
                          colors: AppColors.storyRing,
                        )
                      : null,
                  color: bubble.highlighted
                      ? null
                      : dark
                          ? AppColors.storySeenRingDark
                          : AppColors.storySeenRingLight,
                ),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: theme.scaffoldBackgroundColor,
                  ),
                  child: ClipOval(
                    child: image == null
                        ? const ColoredBox(
                            color: AppColors.primary,
                            child: Icon(Icons.auto_stories_rounded,
                                color: Colors.white),
                          )
                        : StoryImage(url: image),
                  ),
                ),
              ),
              const SizedBox(height: 5),
              Text(
                story.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight:
                      bubble.highlighted ? FontWeight.w600 : FontWeight.w400,
                  color: bubble.highlighted
                      ? theme.colorScheme.onSurface
                      : theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
