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

  /// A bubble was tapped: the viewer opens at bubble [index].
  final ValueChanged<int> onOpen;

  static const double bubbleSize = 68;
  static const double height = 108;

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
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 4),
                itemCount: bubbles.length,
                separatorBuilder: (context, index) => const SizedBox(width: 6),
                itemBuilder: (context, index) => _Bubble(
                  bubble: bubbles[index],
                  onTap: () => onOpen(index),
                ),
              ),
            ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.bubble, required this.onTap});

  final StoryBubble bubble;
  final VoidCallback onTap;

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
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: size + 8,
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
