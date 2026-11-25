# Authoring multilingual section links

Use explicit `/en-CA` and `/fr-CA` prefixes for internal call-to-action and project links when the reader should stay in the current language.

For example, use `/en-CA/about?source=section#team` in the English catalog and `/fr-CA/about?source=section#team` in the French catalog. Keep the destination path, query and fragment identical after the locale prefix. For the home page, use `/en-CA` and `/fr-CA`.

The app renders the destination you write. An unprefixed link such as `/about` can trigger locale negotiation from the browser's language preferences. Use only routes that the generated profile provides. For external URLs, mail links and fragment-only destinations, use the same destination across catalogs.

## Edit bilingual booking copy

When Calendly is selected, edit `apps/web/content/en-CA/booking-calendly.yaml` and `apps/web/content/fr-CA/booking-calendly.yaml` for the booking heading, summary, link, frame, dialog, close action and unavailable message. Keep all seven values in each file.

## Edit the global error page

Keep the three French messages under `error` in `apps/web/content/fr-CA/localized-content.yaml`. The English global fallback uses `apps/web/content/en-CA/observability.yaml`. The global page recovers the supported language from the URL.
