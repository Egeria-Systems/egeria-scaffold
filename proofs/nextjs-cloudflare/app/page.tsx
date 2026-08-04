import { proofCopy } from "../src/content/read-proof-copy";
import { CompatibilityPage } from "../src/presentation/compatibility-page";

export default function Page() {
  return <CompatibilityPage copy={proofCopy.page} />;
}
