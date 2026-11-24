# One version for web/, mobile/ and backend/: VERSION, mirrored in web/package.json and
# mobile/pubspec.yaml. Releasing: README.md#-releases.
VERSION := $(shell cat VERSION)
TAG     := v$(VERSION)

.PHONY: version bump-patch bump-minor bump-major check-version release release-video promote

version:
	@echo $(VERSION)

bump-patch bump-minor bump-major:
	@scripts/release/bump.sh $(@:bump-%=%)

check-version:
	@scripts/release/check-version.sh

# Tags the commit on main and pushes the tag: the release workflow creates the prerelease.
release: check-version
	@[ "$$(git rev-parse --abbrev-ref HEAD)" = main ] || { echo "Release from main" >&2; exit 1; }
	@git diff --quiet HEAD || { echo "Commit your changes first" >&2; exit 1; }
	@git fetch -q origin main && [ "$$(git rev-parse HEAD)" = "$$(git rev-parse origin/main)" ] || \
	  { echo "Pull or push first: HEAD differs from origin/main" >&2; exit 1; }
	git tag -a $(TAG) -m "$(TAG)"
	git push origin $(TAG)
	@echo "Prerelease: https://github.com/radio-crestin/radiocrestin.ro/releases/tag/$(TAG)"

# The release's narrated video, attached and leading its notes (needed before promote).
release-video:
	@scripts/release/video.sh $(TAG)

promote:
	@scripts/release/promote.sh $(TAG)
