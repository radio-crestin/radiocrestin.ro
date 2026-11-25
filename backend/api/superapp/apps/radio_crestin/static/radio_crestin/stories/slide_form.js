// Story slides in the admin: shows only the fields a slide's type and call to action use.
(function () {
  'use strict';

  var MEDIA = {
    image: ['image'],
    video: ['video', 'poster'],
    youtube: ['youtube_url'],
    instagram: ['instagram_url'],
  };
  var ALL_MEDIA = ['image', 'video', 'poster', 'youtube_url', 'instagram_url'];
  var TARGETS = {
    url: ['cta_url', 'cta_open_in'],
    app_link: ['cta_app', 'cta_app_url', 'cta_android_intent_uri', 'cta_fallback_url'],
    in_app: ['cta_route', 'cta_fallback_url'],
    story: ['cta_story'],
  };
  var ROUTES = {
    station: ['cta_station'], song: ['cta_song'], announcement: ['cta_announcement'],
    form: ['cta_form'], share: ['cta_share_text'], settings: [],
  };
  var ALL_CTA = ['cta_label', 'cta_target', 'cta_url', 'cta_open_in', 'cta_app', 'cta_app_url',
    'cta_android_intent_uri', 'cta_fallback_url', 'cta_route', 'cta_station', 'cta_song', 'cta_announcement',
    'cta_form', 'cta_share_text', 'cta_story', 'cta_color'];

  // A slide's form is its fields' name prefix ("slides-0-"): Unfold's inline forms have no id of their own.
  function field(prefix, name) {
    return document.querySelector('[name="' + prefix + name + '"]');
  }

  function row(prefix, name) {
    var input = field(prefix, name);
    return input && (input.closest('.field-row') || input.closest('.form-row'));
  }

  function value(form, name) {
    var input = field(form, name);
    return input ? input.value : '';
  }

  function show(form, names, visible) {
    names.forEach(function (name) {
      var element = row(form, name);
      if (element) element.style.display = visible ? '' : 'none';
    });
  }

  function update(form) {
    show(form, ALL_MEDIA, false);
    show(form, MEDIA[value(form, 'type')] || [], true);
    var hasCta = value(form, 'cta_style') && value(form, 'cta_style') !== 'none';
    show(form, ALL_CTA, false);
    if (!hasCta) return;
    show(form, ['cta_label', 'cta_target', 'cta_color'], true);
    var target = value(form, 'cta_target');
    show(form, TARGETS[target] || [], true);
    if (target === 'in_app') show(form, ROUTES[value(form, 'cta_route')] || [], true);
  }

  function formOf(element) {
    var match = /^(slides-\d+-)/.exec(element.name || '');
    return match && match[1];
  }

  function init() {
    document.querySelectorAll('select[name^="slides-"][name$="-type"]').forEach(function (select) {
      var form = formOf(select);
      if (form) update(form);
    });
  }

  document.addEventListener('change', function (event) {
    var name = event.target && event.target.name || '';
    if (!/-(type|cta_style|cta_target|cta_route)$/.test(name)) return;
    var form = formOf(event.target);
    if (form) update(form);
  });
  document.addEventListener('formset:added', init);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
