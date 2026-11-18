# Authoring multilingual section links

Use explicit `/en-CA` and `/fr-CA` prefixes for internal call-to-action and project links when the reader should stay in the current language.

For example, use `/en-CA/about?source=section#team` in the English catalog and `/fr-CA/about?source=section#team` in the French catalog. Keep the destination path, query and fragment identical after the locale prefix. For the home page, use `/en-CA` and `/fr-CA`.

The app renders the destination you write. An unprefixed link such as `/about` can trigger locale negotiation from the browser's language preferences. Use only routes that the generated profile provides. For external URLs, mail links and fragment-only destinations, use the same destination across catalogs.
