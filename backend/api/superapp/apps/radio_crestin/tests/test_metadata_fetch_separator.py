from django.forms import modelform_factory
from django.test import SimpleTestCase

from ..models import StationsMetadataFetch


class SeparatorFormTests(SimpleTestCase):
    def test_the_admin_form_keeps_the_spaces_around_the_separator(self):
        form = modelform_factory(StationsMetadataFetch, fields=['split_character'])({'split_character': ' - '})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data['split_character'], ' - ')
