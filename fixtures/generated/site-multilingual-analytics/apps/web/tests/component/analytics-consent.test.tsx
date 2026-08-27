import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnalyticsConsent } from "../../src/integrations/analytics/analytics-consent";
import { readAnalyticsContent } from "../../src/integrations/analytics/analytics-content";
import { analyticsSettings } from "../../src/integrations/analytics/analytics-settings";

describe("analytics consent", () => {
  it("supports decline, later grant, management, and withdrawal", async () => {
    const user = userEvent.setup();
    const runtime = {
      read: vi.fn(() => null),
      grant: vi.fn(),
      decline: vi.fn(),
      withdraw: vi.fn(),
    };
    const content = readAnalyticsContent("en-CA");

    render(
      <AnalyticsConsent
        settings={analyticsSettings}
        content={content}
        runtime={runtime}
      />,
    );

    expect(await screen.findByRole("dialog", { name: content.heading })).toBeVisible();
    expect(screen.getByText(content.summary)).toBeVisible();
    await user.click(screen.getByRole("button", { name: content.declineLabel }));
    expect(runtime.decline).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: content.manageLabel })).toBeVisible();

    await user.click(screen.getByRole("button", { name: content.manageLabel }));
    await user.click(screen.getByRole("button", { name: content.allowLabel }));
    expect(runtime.grant).toHaveBeenCalledWith(analyticsSettings);

    await user.click(screen.getByRole("button", { name: content.manageLabel }));
    await user.click(screen.getByRole("button", { name: content.withdrawLabel }));
    expect(runtime.withdraw).toHaveBeenCalledWith(analyticsSettings);
  });
});
