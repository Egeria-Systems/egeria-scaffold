import type { NavigationItem } from "../content/content-schema";

export type ContentPageProperties = Readonly<{
  heading: string;
  summary: string;
  navigation: readonly NavigationItem[];
}>;

export function ContentPage({
  heading,
  summary,
  navigation,
}: ContentPageProperties) {
  return (
    <main>
      <article>
        {navigation.length > 0 ? (
          <nav>
            <ul>
              {navigation.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <h1>{heading}</h1>
        <p>{summary}</p>
      </article>
    </main>
  );
}
