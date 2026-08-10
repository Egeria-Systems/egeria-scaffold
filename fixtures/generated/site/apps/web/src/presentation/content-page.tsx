import type { NavigationItem, PageSection } from "../content/content-schema";
import { SectionComposition } from "../sections/section-registry";

export type ContentPageProperties = Readonly<{
  sections: readonly PageSection[];
  navigation: readonly NavigationItem[];
}>;

export function ContentPage({
  sections,
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
        <SectionComposition sections={sections} />
      </article>
    </main>
  );
}
