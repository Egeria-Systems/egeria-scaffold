// Exact candidate inputs from the independently reviewed manifest. Source admission
// remains a separate decision on the frozen successor diff; no image is rewritten.
function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const baselinePaths = Object.freeze([
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
  "apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
]);
const record = freeze({
  "schemaVersion": 1,
  "sourceProfile": {
    "name": "portfolio",
    "version": "0.11.7"
  },
  "targetProfile": {
    "name": "app",
    "version": "0.2.7"
  },
  "manifestSha256": "2ad0a26ad45871401941d5202781e43233a00e86e9f12e00f447e3d1245a2a6d",
  "sourceRevision": "4ed455ccde1e6129ffad4ae825e9aff8dedc56ca",
  "targetLockfileFingerprint": "sha256:78ac7e12de2b35c3486eb9f471d80cf2ae33c370768838d7e0fdb62bf85c9706",
  "baselines": {
    "monolingual": [
      "sha256:6f6dd1ddd3049d998ac51b4da17b7eb66ca481b89f9e4947fb68b0bce1af50d5",
      "sha256:00e95d03593487ac4a6bb3e08afe9a1df475ecb76b8b1f1da676259ccf551d27"
    ],
    "multilingual": [
      "sha256:d737921e3ceba92f58c1aa0fd728d7e8ecfd20dafb3e8241487e105d8f8aab8c",
      "sha256:b2eecb8f5a8d18f8b4f7516073b57f7faca8df1e947df37883e301d61403fd17"
    ]
  },
  "subsets": {
    "none": "sha256:4a159aa4fd322131abd5c2d272b9c2312870e0012fbaa945c6b57191de631295",
    "analytics": "sha256:cfe0d58c883f14c8542eee0e431decb0b6eb6a5b351f9c1bfa9e55f40027145c",
    "booking-calendly": "sha256:7a29d377df99a7724f4f1ad8a8a2ca67aaa1c9e64055fee4dd2c2e74317e519f",
    "analytics+booking-calendly": "sha256:b40a377ae05d2452c0c4f80f9a19b55a0503659e34382e50d019d4127e6f3414",
    "multilingual": "sha256:120f44139cb0b11436e47de731cae55571159cbc1f37b3279e21f9494b100154",
    "analytics+multilingual": "sha256:3833aa085f0a67808d8b540a9c721cd72ee5dd5bc0ede0c8751a6285c5b59ff6",
    "booking-calendly+multilingual": "sha256:861ac44e56e31399a91116f32d715e50b7900c056bd447bf62b3f027b3e4bb54",
    "analytics+booking-calendly+multilingual": "sha256:790f9e9177025f0c931836bb48f7983cfb00d8198753be9d39e0593140254c0d"
  },
  "originalSourceFiles": [
    {
      "path": "package.json",
      "sha256": "1927887429728c1d02881db25dd5d70c2bc538df46de0f0b6ead53bbd95ef468"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-app-0.2.7-persistence/pnpm-lock.yaml",
      "sha256": "a7e16b5be977f258f483d0bb7281b1bd8e409967bf51ccd607be2312e16da21d"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-app-0.2.7/pnpm-lock.yaml",
      "sha256": "78ac7e12de2b35c3486eb9f471d80cf2ae33c370768838d7e0fdb62bf85c9706"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-app-0.3.0/pnpm-lock.yaml",
      "sha256": "78ac7e12de2b35c3486eb9f471d80cf2ae33c370768838d7e0fdb62bf85c9706"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-portfolio-0.11.7-foundation/pnpm-lock.yaml",
      "sha256": "ff44ba1b1f77d18889d748164e8939b2df6ca9e063fd122ab29e8d9925b060c9"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-portfolio-0.11.7/pnpm-lock.yaml",
      "sha256": "a19f890d98ca4ab97f16488a69e3671783545d1385dd3d6e421649dc1308e0f1"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-portfolio-0.12.0/pnpm-lock.yaml",
      "sha256": "a19f890d98ca4ab97f16488a69e3671783545d1385dd3d6e421649dc1308e0f1"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-site-0.12.7/pnpm-lock.yaml",
      "sha256": "be78333c0f57123df4d871b89b5f9bc5d9e6eb332aa2d7d276758b5676ab1e79"
    },
    {
      "path": "packages/builder-core/lockfiles/web-recipe-site-0.13.0/pnpm-lock.yaml",
      "sha256": "be78333c0f57123df4d871b89b5f9bc5d9e6eb332aa2d7d276758b5676ab1e79"
    },
    {
      "path": "packages/builder-core/package.json",
      "sha256": "580cf540c0c2af995bd7465729f453d45884528a7df8ec0af42660693dd3e3e4"
    },
    {
      "path": "packages/builder-core/scripts/compile-content-validation.mjs",
      "sha256": "937792d04a93e914aa70f5899b825e743bd110e2bf0c66381951a9d877299cb0"
    },
    {
      "path": "packages/builder-core/scripts/generate-json-schemas.mjs",
      "sha256": "c786065fa155a696a1b8c498a4b4ef06d6d9e99a48ae1218d9c95ac6f1281a57"
    },
    {
      "path": "packages/builder-core/src/catalog/capability-catalog.ts",
      "sha256": "1568f27bcbac3c7dbc2c77cb5f4ee51b9c85294f7195880e3a85712b56d1ef55"
    },
    {
      "path": "packages/builder-core/src/catalog/verified-package-versions.ts",
      "sha256": "d312baa81455aa45b6d1edcbcc3a21174e248810a78b2ea03663d9dc51887477"
    },
    {
      "path": "packages/builder-core/src/certification/capability-certification.ts",
      "sha256": "2bcf78d083a647741be734e3bdf48b36ea94ec67cd5a46dc2ca3cb2a4bafcba0"
    },
    {
      "path": "packages/builder-core/src/contracts/capability.ts",
      "sha256": "580ab495ae3bfd2582ea5876a180e3431a7c0158e02fd0986d55cb02ba149222"
    },
    {
      "path": "packages/builder-core/src/contracts/certification.ts",
      "sha256": "ce68b3bed3ae935cc9b4fecde3d94c5f64e52c4dc28f04fd0cfe212f62312d06"
    },
    {
      "path": "packages/builder-core/src/contracts/generation-verification.ts",
      "sha256": "7147c0334a3b46e421a74cd3eafcc18fa835f82017d3ea9fa3ebfb1d312d5ab1"
    },
    {
      "path": "packages/builder-core/src/contracts/identifiers.ts",
      "sha256": "8c2261ab7bd93934f166d964aebab19614597780d06757044f3dcee12482991c"
    },
    {
      "path": "packages/builder-core/src/contracts/job-removal-evidence.ts",
      "sha256": "dd32b3dd00257a00ddfbb4813e602b41f7da1ac80623441edfcb593a0ed46583"
    },
    {
      "path": "packages/builder-core/src/contracts/json-schemas.ts",
      "sha256": "094818f04e8366d4015c8c96975c9708f115b9b81bcb68dd976f98b786525e14"
    },
    {
      "path": "packages/builder-core/src/contracts/migration.ts",
      "sha256": "9e77d6596d664c087c17a97609f286f923f90d4b6aa54c07de9d77911a74d8a0"
    },
    {
      "path": "packages/builder-core/src/contracts/persistence-removal-evidence.ts",
      "sha256": "1ebbdffdce9e9fbac67e93738892abc2285174a3d970b339bebd0edd2c40e578"
    },
    {
      "path": "packages/builder-core/src/contracts/profile.ts",
      "sha256": "b0b3e1d3e31f0d85f255960a84b364f0e1f9c06a13ccfd34724de4c373f79f49"
    },
    {
      "path": "packages/builder-core/src/contracts/project.ts",
      "sha256": "4286a73c5cffce35a02383e8542ef0d399ba240b726aaadd80e93e22eae270ac"
    },
    {
      "path": "packages/builder-core/src/contracts/result.ts",
      "sha256": "3a8f0ebab47c908ca713ce5489ebf17f48262da95c71268cd8f4f38404486d1d"
    },
    {
      "path": "packages/builder-core/src/contracts/state.ts",
      "sha256": "0c2458118c418651cd9772082ca23e59db6b72082c8322c7b66183e0bbb36e19"
    },
    {
      "path": "packages/builder-core/src/contracts/surface-target.ts",
      "sha256": "da509d489598e47228ad73c2bbc0ad36e9b8dbb3ff5691618d439393dd358476"
    },
    {
      "path": "packages/builder-core/src/diagnostics/diff-project.ts",
      "sha256": "65a486ec02b6044d1d4abb6a7abb3ebca2e1ef08a3859b7411c648d1df351080"
    },
    {
      "path": "packages/builder-core/src/diagnostics/doctor.ts",
      "sha256": "dd376f2efe857c29cfd671df72e482a0e8cfc14f79037b7be2e32047d88eb2c0"
    },
    {
      "path": "packages/builder-core/src/diagnostics/project-inspection.ts",
      "sha256": "0a30d2709a34ea3a5863e03d7c8b80128dd56987933463424985877c9db8b7fd"
    },
    {
      "path": "packages/builder-core/src/generation/builder-state-surfaces.ts",
      "sha256": "8686d19b5dca4a68dfb58c04c16f921a82e67e1ea4c76a01f0782114917bd560"
    },
    {
      "path": "packages/builder-core/src/generation/recipe-lockfiles.ts",
      "sha256": "db21706a69975a602ff5b6461f0821785c4b75e25942fdfa9ac9ef2e4c6b45ff"
    },
    {
      "path": "packages/builder-core/src/generation/render-skeleton.ts",
      "sha256": "6d5eac17724cf58163c328f3260ce23fc28bc7797baa52739c7173f73b38d0e1"
    },
    {
      "path": "packages/builder-core/src/generation/render-template.ts",
      "sha256": "b7aea2c1616c21f4dadd0cbad8ed8df4bac161f6b4d985ca5027bf4bdb7748f7"
    },
    {
      "path": "packages/builder-core/src/generation/source-tree-safety.ts",
      "sha256": "a87efd5bf2af482f1cbd3bafe2ce4c1e0c2dec1240da763f10127a76d21ec4cd"
    },
    {
      "path": "packages/builder-core/src/generation/template-catalog.ts",
      "sha256": "299a365c5fbfab64e7ed5673510555241b9557ab796ccdad4942f190175a8b55"
    },
    {
      "path": "packages/builder-core/src/generation/verify-generated-project.ts",
      "sha256": "84bd50a9716b8f60bcbf05502a7f0d81781feeb323a185fee5bfc77d026d3011"
    },
    {
      "path": "packages/builder-core/src/generation/write-generated-project.ts",
      "sha256": "24642819c161fa99b96f1a483095272052f959403ebcb99f056e267e70c1fabd"
    },
    {
      "path": "packages/builder-core/src/index.ts",
      "sha256": "ab3e36dea04961367b7855cf10592dfdea673562bc3ddcbabe776fe78ed4b8b0"
    },
    {
      "path": "packages/builder-core/src/inference/evaluate-probe.ts",
      "sha256": "1d978a9409a2eff2c8ffdfa388dbbd496fb23b5e7e774b1af321e8a12d945b84"
    },
    {
      "path": "packages/builder-core/src/inference/infer-repository.ts",
      "sha256": "67e39e67967eb656ac1a05ab032a9b73ea51e340fcfbabf0a26ec056be1a4d15"
    },
    {
      "path": "packages/builder-core/src/lifecycle/app-profile-transition.ts",
      "sha256": "4f3160334bea9796487b16d3158a0e9c623943cb4027dbc0edbc983a03a03d64"
    },
    {
      "path": "packages/builder-core/src/lifecycle/app-transition-content-validation.ts",
      "sha256": "b4d2a7d1af5cd0d763da832868b0c71d2d4360781aa5635db8c6b5e6d3dac7a5"
    },
    {
      "path": "packages/builder-core/src/lifecycle/apply-capability-addition.ts",
      "sha256": "9db8a980dbb78b5f70b3eca366559d98085528d285eae56ca839bd0f9c711f00"
    },
    {
      "path": "packages/builder-core/src/lifecycle/apply-capability-removal.ts",
      "sha256": "b3704320f3c47d2cc4319ef319eb69e4b34cea9a1276b2f8972aec1b6e3baa2a"
    },
    {
      "path": "packages/builder-core/src/lifecycle/apply-profile-transition.ts",
      "sha256": "b1d1f80d9c4084bb9f6b5ef4726fd06ec0673d9a99f3b4ac6c7b9049cb484e5b"
    },
    {
      "path": "packages/builder-core/src/lifecycle/atomic-file-change-writer.ts",
      "sha256": "5e4cedd5c4e89079c742a5f081d2c3ce582484e8c3ede2134a726cbdfa955c55"
    },
    {
      "path": "packages/builder-core/src/lifecycle/capability-addition-writer.ts",
      "sha256": "6a2a4de0348991e035e0fa545e50dc32f11901f80cdd3ebae87c5de1009149bd"
    },
    {
      "path": "packages/builder-core/src/lifecycle/capability-removal-file-operation.ts",
      "sha256": "069d266c7fd402e3dd76810dd85a0fcfbf7cbcf011802c894c61fedf657dbabf"
    },
    {
      "path": "packages/builder-core/src/lifecycle/capability-removal-reference-guard.ts",
      "sha256": "45d210ba3ccf504ac8aa8d6e731ca73362bb6442c9c51039f35d2b65cfebf91f"
    },
    {
      "path": "packages/builder-core/src/lifecycle/capability-removal-writer.ts",
      "sha256": "deeeec7b9ade61a458183f7e3c6a16d88a92a85ea075373132b1bca9709b3b7a"
    },
    {
      "path": "packages/builder-core/src/lifecycle/git-worktree-inspection.ts",
      "sha256": "2cddf1004a801ae521c30b988f1f704c342ea4bae0eb2a3495eadb2e434099c1"
    },
    {
      "path": "packages/builder-core/src/lifecycle/lifecycle-control-persistence.ts",
      "sha256": "a6a0f70f239b38ba5c823af70562f92cde4c973639b8ccbf4243b2a1b6310ddb"
    },
    {
      "path": "packages/builder-core/src/lifecycle/lifecycle-control-snapshot.ts",
      "sha256": "0074880e25cb59051c6b8f066d2aafd5f051eed337cc337955715df1a9ab1223"
    },
    {
      "path": "packages/builder-core/src/lifecycle/plan-capability-addition.ts",
      "sha256": "f499a995293dfee796145a57e0c57db04f3096d4bb07f9b6e7c654a546199d20"
    },
    {
      "path": "packages/builder-core/src/lifecycle/plan-capability-removal.ts",
      "sha256": "7b150e34e01595c1002997f6cd1aeb24adcd33fff2c2530c57016a17f37639be"
    },
    {
      "path": "packages/builder-core/src/lifecycle/plan-profile-transition.ts",
      "sha256": "fc7475bebac3fa18ca02a1767e97d0f90a52bde9150e80298170dc4b675df835"
    },
    {
      "path": "packages/builder-core/src/lifecycle/prepare-capability-dependency-change.ts",
      "sha256": "554410c19101a59f6b960f8d708fa835624565b3184aae8f1bd7c0c5677aec76"
    },
    {
      "path": "packages/builder-core/src/lifecycle/profile-transition-writer.ts",
      "sha256": "feb55d1e600391df2d957a79cf204a4c631b44180cdac517e1906973ea443c53"
    },
    {
      "path": "packages/builder-core/src/lifecycle/review-job-removal-evidence.ts",
      "sha256": "3f2878a336fa53251d1055d1b599c2648ae54e61163f45e5c912376562d97a5e"
    },
    {
      "path": "packages/builder-core/src/lifecycle/review-persistence-removal-evidence.ts",
      "sha256": "98bd2af9ca425abb5c7645ff183c6d08621a0a640d1ef01e8b130a783debb861"
    },
    {
      "path": "packages/builder-core/src/lifecycle/supported-profile-transitions.ts",
      "sha256": "c9dbddfdd1ed5207afe8847c51d0bf65b1327ff3d3f3571bf333d7490cae95f5"
    },
    {
      "path": "packages/builder-core/src/manifest/create-installed-manifest.ts",
      "sha256": "f732c347553267158ab0fdd3bc83addd6506b11c0bde97104bddaabd78ff7f78"
    },
    {
      "path": "packages/builder-core/src/ownership/fingerprint.ts",
      "sha256": "88fa750b7700b3efe83e356a458582a823d1469adcdfb3f5d98b4a16647f51a6"
    },
    {
      "path": "packages/builder-core/src/ownership/materialize-surfaces.ts",
      "sha256": "34386398e71a075b69e693d3eee0d4c04675a17a7a40a8e918a9bd1f914224fd"
    },
    {
      "path": "packages/builder-core/src/profiles/profile-recipes.ts",
      "sha256": "41921ffd9ec4c40752324e70f8be40849aeb831c216d6625dc60292137f97053"
    },
    {
      "path": "packages/builder-core/src/repository/cache-reader.ts",
      "sha256": "f0d6521fac15d8d1780e86b322dc66f6486ff75ff40af52acec2700a1470b13d"
    },
    {
      "path": "packages/builder-core/src/repository/repository-reader.ts",
      "sha256": "1df9c827d5fbd28848a7f20399c3d1c4616c8310e284b5f803b009e23c42bf56"
    },
    {
      "path": "packages/builder-core/src/resolution/resolve-capabilities.ts",
      "sha256": "a7e4f0ca0b727f9922ddb40cd1d49dc07ba09b03090b260ebf1976fb2fd0b2d4"
    },
    {
      "path": "packages/builder-core/src/serialization/canonical-json.ts",
      "sha256": "4275ab432e72925a549d505866b2e7149b6519b92f07f549ecf32f4dfdf9d0a3"
    },
    {
      "path": "packages/builder-core/src/state/codecs.ts",
      "sha256": "20081eccae9b6702eaeda10fede459dc4054e82d84cd4ceba1f1cb75533f672c"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/app/layout.tsx",
      "sha256": "fdeb0ab69d6a93e0721aeecf1f3501812974c61cd79cdd495d9f31b512ba09c5"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/content/en-CA/analytics.yaml",
      "sha256": "f0a1be2a8b2ed776135dc2016efba22c46bb0c5f9db63b97164bf215d3927b70"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/content/fr-CA/analytics.yaml",
      "sha256": "62fcedcd77ab878cbe08d3f7eafa8ca0c3126b4f8a2e0d087c00abb7fe787bff"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/src/integrations/analytics/analytics-consent-state.ts",
      "sha256": "f15bc9dab85afb47dc54b25213ca2884ff207dd6455cc85e1e70a098c3185488"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/src/integrations/analytics/analytics-consent.tsx",
      "sha256": "da6eb35682a44881e8c7e6433f3a2b8bc3bf9843ed77e28da71fb6dcfe56d13c"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/src/integrations/analytics/analytics-content-source.d.ts",
      "sha256": "6892d22339ab873059d23d94d01bea671e3e6a4d293ee4910b9d3e36726c6bee"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/src/integrations/analytics/analytics-content.ts",
      "sha256": "ddd22b280ee18e5d16d21a9ae9aa0970a96f704ffd529e52ca67d3e453926a33"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/src/integrations/analytics/analytics-provider-contract.ts",
      "sha256": "13922c48207ef793d352afe7b33de27c9a08a8828539a03a99444a9791432cf2"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/src/integrations/analytics/analytics-runtime.ts",
      "sha256": "667874813d58f0dc00dd2f006d6283bd43daeeb00a1d257fd0ae3d05985f5a2d"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/src/integrations/analytics/analytics-settings.ts.template",
      "sha256": "c979223c9e4c017d6bbd1df5271f836f88b90396ffb893e67a591cb19cc37a55"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/tests/component/analytics-consent.test.tsx",
      "sha256": "01b4a65000213d7d22b0c02eddbb34a0b56ecff1b2a98ea58ff8cdbe8281e535"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/tests/e2e/analytics-consent.spec.ts",
      "sha256": "9b7b3d973de23d680cc456668ec1978158f9a22edb3bbcea763ccc5c842e2731"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/tests/unit/analytics-consent-state.test.ts",
      "sha256": "4680f4aab0bc16573dc3bc7e78e0c6ac3decd8baccbc44af80470c99f7f8cdd1"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/tests/unit/analytics-provider-contract.test.ts",
      "sha256": "bcfd0f566590ce86c3776da653a1b221950bb340103a7650bbfb1c6521b28f6c"
    },
    {
      "path": "packages/builder-core/templates/analytics/apps/web/tests/unit/analytics-runtime.test.ts",
      "sha256": "b5501dcaa6c18b57fa92159292a120490ae5c813d00c9f9ceffe0632b4f5f6ef"
    },
    {
      "path": "packages/builder-core/templates/analytics/docs/analytics.md",
      "sha256": "83a57a5d351483d9265d4248e7336fc8a4a37a14ff7f06811534e600e86b40e8"
    },
    {
      "path": "packages/builder-core/templates/analytics/multilingual/apps/web/app/layout.tsx",
      "sha256": "abdc51373ab53a68ef4f5aee4dfe077a68e37c9a8b34baf5016eb9b68f53b0fe"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/application-environments/apps/web/app/api/health/route.ts",
      "sha256": "a27bd1e2c97624c9a86d8415a9f7b093486d8c825c1c3c6f71fa6aa4ed85e790"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/application-environments/apps/web/docs/application-boundaries.md",
      "sha256": "1da894c957c2ea02ed196b0040568f28fe3a5e07838c7c8f143d95d3054dd79f"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/application-environments/apps/web/src/composition/server-health.ts",
      "sha256": "e74ae05952c40745e06140759a1e19c097877dbb4b296f9a5352172335cc99f9"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/application-environments/apps/web/src/delivery/health-route.ts",
      "sha256": "a7b4f14c2b99277b56d4a5ed4d0ec017480365ae2e17d600f159d5db5ffdb71b"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/application-environments/apps/web/src/infrastructure/cloudflare/application-environment.ts",
      "sha256": "0c0827e0dc67197e058bce330cb3da736fceb10bae16b050c0e0b2555a3b62a5"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/application-environments/apps/web/tests/integration/health-worker.test.ts",
      "sha256": "c93e70c1e53ad431d0d43b36cfd506f4dbf7f6ef4bd9ca2f6276ce2720208a27"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/application-environments/apps/web/tests/unit/health-route.test.ts",
      "sha256": "4179dde3712ef350b92c501dc737f9806a998c6d29acca90a5de9f6eb05f637a"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/app/api/health/route.ts",
      "sha256": "95a33043b7a147107b6931f3ef015b9993e228e49dda0adafa6815a3b7f3d640"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/docs/application-boundaries.md",
      "sha256": "e31e7d17db24b47d52a62403fa0c16bbcaf0e80e8af08dc42dd01ccbeb0f7ab7"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/application/build-information-reader.ts",
      "sha256": "9a77897a7789e6cc888aed3808ffe03e28808eee568de165d50b514fdde4fb60"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/application/health.ts",
      "sha256": "c9c0bb42e519e438c5252c32bc9525e9b7f0b9272ab5b9f51285a97598cf0caa"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/application/request-context.ts",
      "sha256": "747954e6f154921a09d7b35b962fc6e1be7ed55fb1ce72cb21be0fe0bf448b25"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/composition/server-health.ts",
      "sha256": "28eaf1b18ca956dc5baa4e21969a39725eff5373c949d4ce84263e51f6ff612c"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/delivery/health-route.ts",
      "sha256": "a9b63fc9eeae0cdcfb3cb338d370b368cec1eafdceb5371ed811ed33b11086d9"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/domain/build-information.ts",
      "sha256": "6a82ea50779abe2161000e5258fc9edfa63660a2c5eb4c9b912372d69530c1fa"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/infrastructure/cloudflare/build-information-reader.ts",
      "sha256": "9f1dba2e65ee261e53f96d678342d43ee1e7748c8f1cd1b87c2e6aef64c8bcca"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/src/infrastructure/memory/build-information-reader.ts",
      "sha256": "b3dde1af2b75d2fe0b9742aefee8de4fd54220d504fe59a739d833b32383fa36"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/tests/integration/health-worker.test.ts",
      "sha256": "73b377214bcae68f4a2febf7407bdf23d6c909dd4877e853df76057233037510"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/tests/unit/build-information.test.ts",
      "sha256": "3a15d8e86a56b5d4c6bff011472ee2173b31326320202ca01eab69e385b92c99"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/tests/unit/cloudflare-build-information-reader.test.ts",
      "sha256": "402e107e76e07f8c4873e74677441bc2e2cd09a76c0c578d22e6dc2db2981aff"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/tests/unit/health-route.test.ts",
      "sha256": "af08b1cc8a157d2f377937f63d7a227a12a36c2bfe3e9bd0267015211eb54523"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/tests/unit/health.test.ts",
      "sha256": "d55f4944d73a1c212e60cab4a5c6ce546b896df9b22e908c8520583b57d4ca1e"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/tests/unit/request-context.test.ts",
      "sha256": "cb4fe89f6508758b798558dd8e5b2e3320dd68b8ec15da3173d1eb0185454569"
    },
    {
      "path": "packages/builder-core/templates/app-foundation/apps/web/vitest.cloudflare.config.ts",
      "sha256": "3a5ad5ba76e26fada236f49385ec137b6cc91d658f3e16bc90f6e133c547146f"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/.github/workflows/migrate-application-database.yml.template",
      "sha256": "1c1ddb54e0e89f7c8e4cabf223e4e69948952140d004d44321243820c888e0e6"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/apps/web/drizzle.config.ts",
      "sha256": "f2d3d9838220d2d6d7de5da6b988b6c995b18b450acffd42ffd984c1692393a7"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/apps/web/src/infrastructure/persistence/schema.ts",
      "sha256": "c0c373918383bed14624850b1fd3fac8041192ade58c8dc9f3983744128edc8b"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/apps/web/tests/bindings/application-persistence.test.ts",
      "sha256": "cd3805e8c96557bedbb61fb89141f24434913fd00d3d8c2fdd4c83411215cab6"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/apps/web/tests/bindings/fixtures/migrations/0000_persistence_fixture.sql",
      "sha256": "fa6c1c9bd8d69633d67b292fdb652b29a63f0c8f7f99513ffb9724f8f0d568fd"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/apps/web/tests/bindings/fixtures/migrations/0001_persistence_fixture_index.sql",
      "sha256": "fb993c0ef28575a506e4ac30c04e16a4f935ccf9d41a2de4ffe0f41238495944"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/apps/web/tests/bindings/fixtures/schema.ts",
      "sha256": "6b0e656194a8091070db648b122e4b1f16fd3d8343f1bb8ec96f26dda509d473"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/apps/web/tests/bindings/fixtures/worker.ts",
      "sha256": "8a8b7239f8b002734a4c256ed1d61fb835361644a5bb96098a4ba02f8eb8b0aa"
    },
    {
      "path": "packages/builder-core/templates/application-persistence/docs/application-persistence.md",
      "sha256": "5d464a4f2dcfe608ec508734fb7e2b268fa3d6902161fb06c0e355d299b8444a"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/src/application/job-delivery.ts",
      "sha256": "d0bef2ab42b36a52494636f2c4ae716eb8fea747ab1e0c1b40c1bec95ed905f8"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/src/application/job-handlers.ts",
      "sha256": "240e0c2a4ccad94b6fe81d662725c0a918e4f28e48f3d6bc29c8c2bb7c5dceeb"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/src/composition/server-jobs.ts",
      "sha256": "73da9078d5fefe1857377ba62c8c879005950f87081189d323715b5e1dc650e3"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/src/infrastructure/cloudflare/job-delivery.ts",
      "sha256": "cdd4ef181f723d87bcba80a4021a9a6f99c25c6e45465bb4de0094a975333405"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/src/infrastructure/memory/job-delivery.ts",
      "sha256": "2c80decc1d25bb971b9735c53fa7525c9be98716840efe981cfc2f84d254f33f"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/tests/integration/fixtures/job-worker.mjs",
      "sha256": "946ffdb9e665c3c6c9db4bcb64efb3fcaf697b602bf8b47e787b82609fc9e0c1"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/tests/integration/job-worker.test.ts",
      "sha256": "322adcae51cb3094e73d86218190f871496c219e5067d518e2384c2cc92d3e8d"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/apps/web/tests/unit/job-delivery.test.ts",
      "sha256": "eb9587c149b18edb178e39a33159a7fbde8c6b2081e1a0e5d9a4d7a1cda83fe7"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/docs/background-job-delivery.md",
      "sha256": "dbbea2124e80c3175b5dc3dfbd4d6c89d7eb6820f1ab503987ff0f9efd5d0106"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/operations/apps/web/scripts/job-operator.mjs",
      "sha256": "c5966858c55139aa09778994577781d8ccc9950aeec2e69c52077443f4d80682"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/operations/apps/web/src/infrastructure/cloudflare/job-operations.ts",
      "sha256": "9971c3723c6c225d1862219b346f3eba4a2c66709abc58d9387883f3e1c40ffb"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/operations/apps/web/tests/integration/fixtures/job-worker.mjs",
      "sha256": "e4fad9b6227f8f6f7805ab9a704b9a140715034db0cd6761e9e1e59844169f52"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/operations/apps/web/tests/integration/job-worker.test.ts",
      "sha256": "0b85148e837f46868894d8b4e57fb7c427cc4a75e1f30bacdbaad6737b7dc50c"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/operations/apps/web/tests/unit/job-operations.test.ts",
      "sha256": "ada2edaf86846b0b0767ea50ec731fcafb7a48e413a2dbaa889a36b205d5c81f"
    },
    {
      "path": "packages/builder-core/templates/background-job-delivery/operations/docs/background-job-delivery.md",
      "sha256": "3bee142f099f685b3a3075ce936d78b8578476dc695b85ca3145ac5e9f7269a5"
    },
    {
      "path": "packages/builder-core/templates/booking-calendly/apps/web/app/page.tsx",
      "sha256": "87fd53257bc4d2518ec7cb745243b6c46c440015fab940c74282e7cc37461619"
    },
    {
      "path": "packages/builder-core/templates/booking-calendly/apps/web/content/en-CA/booking-calendly.yaml",
      "sha256": "b865e37a96244aab4519358756795bb0a575e5e816a065477a9a7f3edf517402"
    },
    {
      "path": "packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/booking-content.ts",
      "sha256": "a5942d5a745bcff75098d9ef68ecc5dae587e5b1b409d900dcd1192d32fa294c"
    },
    {
      "path": "packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/booking-settings.ts.template",
      "sha256": "b9bda6209b515b4ce608d4297e3f14be9578f47356be2a4540c596c69426f5d4"
    },
    {
      "path": "packages/builder-core/templates/booking-calendly/apps/web/src/integrations/booking-calendly/calendly-booking.tsx",
      "sha256": "99bf5d995e6e9252ed2c5628d5cfddc2b2d488a56fc23ec431a906eddbac3122"
    },
    {
      "path": "packages/builder-core/templates/booking-calendly/apps/web/tests/e2e/calendly-booking.spec.ts",
      "sha256": "760456449a2dfb77789b1396b4655c7687c956bbd450690c17088a39bee2e838"
    },
    {
      "path": "packages/builder-core/templates/common/.github/workflows/deploy.yml.template",
      "sha256": "04e1516b376d9d45e8c90dd915eedb1edb396135a7a23c9238dbb5f2222169c3"
    },
    {
      "path": "packages/builder-core/templates/common/.github/workflows/quality.yml.template",
      "sha256": "13b9920479cc580714bef7635505f7cbc445db8c1b06e6c8089055640384737e"
    },
    {
      "path": "packages/builder-core/templates/common/.gitignore.template",
      "sha256": "ea9ae5806fbefcbfbc1f39b2dc4bacb4226408ca8355caaa6401d591d46675bb"
    },
    {
      "path": "packages/builder-core/templates/common/.nvmrc",
      "sha256": "08062faf0d7a2d22f5d7933c50e975dd1527034275597be7c1b3b9fd2b9d079a"
    },
    {
      "path": "packages/builder-core/templates/common/AGENTS.md.template",
      "sha256": "4805579b678f72f2004d556ee02b0dbf15cbf649a31ee9b57dbe914bf86c3941"
    },
    {
      "path": "packages/builder-core/templates/common/README.md.template",
      "sha256": "a30b7947966ec607c8a132258759f70b0e0d9b31c6c58713350dd3a4d420b7ef"
    },
    {
      "path": "packages/builder-core/templates/common/application-environments/apps/web/next.config.ts",
      "sha256": "8d823fea8dce696174bd0d942baf86387fe982c7a3cd03544f70680a6055343f"
    },
    {
      "path": "packages/builder-core/templates/common/application-environments/apps/web/wrangler.jsonc.template",
      "sha256": "0ea51351d42b34141361ebdf87f9f2dbf549a76a827573dc6de7396ba1b40e4b"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/AGENTS.md.template",
      "sha256": "861317ba9ccc3af1f82e6b650aa502caebc4a499a362e4a422bbc98a43e58839"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/app/api/observability/route.ts",
      "sha256": "a9373820327bdfa94cddf625e90e9d6372d921044c3aabfedd4f8ed59ec69d07"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/app/error.tsx",
      "sha256": "829b25e9a75d6a89bb4a875b14dcec62c8df0ba48641e4c9cba5b2e77ab8daa0"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/app/global-error.tsx",
      "sha256": "e4cb19f30f11d647a41ef45c9c5911706769ebc9842797802ab1e100c7b2bd9d"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/app/globals.css",
      "sha256": "f01825fbb5aa782f14f9c24ee6934fc8dcc9b6c1aab96864d651cc001ba28be2"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/app/layout.tsx",
      "sha256": "dc909d1a1943e8374c5cb3f3144ecb7922f4a58c02b971e3ff9d7a2a465e2f93"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/app/page.tsx",
      "sha256": "5affb1baee147023b57f32c9947fab4c64de9afe613fe89d28c6ff4e2a2231e8"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/content/content.config.yaml",
      "sha256": "4f827edda6b1bde315c4e0add09dae1df69aeb6c2e4593fa6ba23eae430ebc55"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/content/en-CA/observability.yaml",
      "sha256": "a05df3a90a920a747842dbd766a68c0f52df8a90978a2419836df83313519550"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/eslint.config.mjs",
      "sha256": "d8458336de55b7e4de72711619490a857d1a1f16d2004f2d7e1d2f98ecab84df"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/instrumentation-client.ts",
      "sha256": "9722b012487e7cd514f42f8fee02e37ee2706a45db02bc7e33156963bdf40d0c"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/instrumentation.ts",
      "sha256": "9478268eeae340750033378816f0fdf86d931722740fb99b61ad30762fed0da0"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/next.config.ts",
      "sha256": "9a7e515381b029b4f2bafdd1feec366a17f2664bdfd2929ed9571090009e4d80"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/open-next.config.ts",
      "sha256": "8e02c850592160eb80d1aed908789f317babcb76985792a86bb79e7c0dd4b1d9"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/playwright.config.shared.ts",
      "sha256": "89c07b78bb0442f65664afb83e56ec37d1b0d7d3ca1698901a2abad9433ffd1a"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/playwright.deployed.config.ts",
      "sha256": "d4da22b547bbcc589aaf1c1c9b0ece4e8254ab658612237f167034fa52b2f2b5"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/playwright.dev.config.ts",
      "sha256": "a2a11cb72cb9009fff32b2e00240fa804943995f2ddee7fe8963a039d712f379"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/playwright.preview.config.ts",
      "sha256": "50b63c0cc129988305244717db0bf7f7a44c3aa2f960930af6934487381636df"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/playwright.visual.config.ts",
      "sha256": "eacad1190c4dec110b823210773f670b017822237afbd1c21889f0fc489de879"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/postcss.config.mjs",
      "sha256": "b24e265a48887c14722800bc0968fa807151a8a08228b2498c43ee860c1b25e9"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/scripts/check-application-environment.mjs",
      "sha256": "c88e6552d52f6e1246f0797d1b36ef5e5c6c8e63e2e7e5e65f79238bfb5fa442"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/configuration/application-environment.ts",
      "sha256": "5ca3b8e631f3784dbd6598844c4c8ecd75a841438022021a96d6dd679385e0d4"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/content/content-schema.ts",
      "sha256": "8c8c4fd3412112fa50773ce02756ccf2f97b265c8b609c35b397bcbac8203085"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/content/content-source.d.ts",
      "sha256": "a7e45b479a8b43ff63ddd7ce893cdfb91488faef53e762648908d98092b12dbb"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/content/read-content.ts",
      "sha256": "448b65e8814d30c3e00338248216618954aec031bcb1ab0caca3cda2f7a037b0"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/infrastructure/cloudflare/observability-context.ts",
      "sha256": "d986d4cf7d8c859cad7f5a4ff1ed28093e0c1279846f3bb935fc59c90b2570f6"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/infrastructure/observability/browser-reporter.ts",
      "sha256": "0c6ea3a819be830d7551c5ab64e1ecad4d00248529d58ed7aaddcb85709ebbca"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/infrastructure/observability/error-copy.ts",
      "sha256": "ef461e56e5bb86bc05b89515cc2789e4201e9eb48f8ac06b7035735219a52c2e"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/infrastructure/observability/installed-capability.ts",
      "sha256": "1ad97f88cab83d93e01953f32104d0583f26793cfe9b35d7a75ed400a05f7956"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/infrastructure/observability/server-reporter.ts",
      "sha256": "f7c925ea38d6d12bd93c70ef940cdf4d7a1d00d1a113f6d70da948e16b64faf7"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/infrastructure/observability/web-vitals-reporter.tsx",
      "sha256": "992ca875960306c6d4df22af9fc2e2d9336745ca5ba3724b11d967c8a0d83f33"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/presentation/content-page.tsx",
      "sha256": "fc3187b34aff7b20c39cf588a199a26eb2c83072694805bd6fb4c5b026882212"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/presentation/error-fallback.tsx",
      "sha256": "f60bdac6ed3c66252ccb5a75d6961584f13a6ed6d35eed3363f8685579276492"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/src/sections/section-registry.tsx",
      "sha256": "f69d5ae9ce4eb7da4b6b76a209c699f8586d886ccdac196dc1299ea6f29720d6"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/tests/component/content-page.test.tsx",
      "sha256": "61b7e37fd0089ca940c8906999643db839ca0cc251b6792343cccb7b3539ad88"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/tests/e2e/site-quality.spec.ts",
      "sha256": "c617c71800f8a300bcca47d0b720a34989ae445d5fc2511a74af1c1b54b23790"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/tests/unit/application-environment.test.ts",
      "sha256": "96a92c18483559b77e1767217ccb4435ef59773764b370adc920c6e76378087c"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/tests/unit/content-schema.test.ts",
      "sha256": "f171b3f82123b2e01fab64edc7f065dd482fb9e6e8fbe642477c68501e8a06c8"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/tests/visual/home-visual.spec.ts",
      "sha256": "566990fcd546fa8f1ec43ca64456e3b6eddd5ff90948d21085074dda98a56eac"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/tsconfig.json",
      "sha256": "69f986f57d11c0d37e288d05805689d37f6caea3664a78d927fcf9e299a751be"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/vitest.config.ts",
      "sha256": "a577adba8d5c6a881826d1934602c50da72f2bca82c3c35715a0b66e997a1f0e"
    },
    {
      "path": "packages/builder-core/templates/common/apps/web/wrangler.jsonc.template",
      "sha256": "2c5c27ed5e1dd193dbca659664f8db6d0788476409d6e2a401a6f855c41fdb2e"
    },
    {
      "path": "packages/builder-core/templates/common/dependency-security/pnpm-workspace.yaml",
      "sha256": "272e73ffbefe40363dfc4568c7e0aca00d1477ca1059990375b0964f7f03f8ba"
    },
    {
      "path": "packages/builder-core/templates/common/docs/environments.md",
      "sha256": "bd628dad97f6ee4692bce669f1ef8bd5da540bb23c61f9e165767524ff81b34f"
    },
    {
      "path": "packages/builder-core/templates/common/literal-lint-roots/patches/next-eslint-plugin-next.patch",
      "sha256": "0d97aaca566ae4a55bd76e0176c30db196d7707e852a9e76deb2eb3668dc55aa"
    },
    {
      "path": "packages/builder-core/templates/common/package.json.template",
      "sha256": "d382fc0b2034d4fcbb8cb752a5ce34069ac41f2034f39ccfc8849b4ebfd2611c"
    },
    {
      "path": "packages/builder-core/templates/common/vitest-five/apps/web/package.json.template",
      "sha256": "3f09ec2bde8f6d8791b75ef8079f5b093700c1874badbe2fd1dd61fb5f9a6a48"
    },
    {
      "path": "packages/builder-core/templates/common/vitest-five/apps/web/tests/setup/component.ts",
      "sha256": "486fd3f10a1d0e0b37727ce3a79368e408f90c3dac604ca18fdfd0bec7dd0dc2"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/app/layout.analytics.tsx",
      "sha256": "51ac93a112d7d018f9f9375c370d3171b8d9ebc39b7d8c774bcfd8e1da5f4dcd"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/app/layout.multilingual-analytics.tsx",
      "sha256": "b9a77d79d3635894f02f34fe978f8fd74ae7fdf1e8ade0757040641fc5a05f5d"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/app/layout.multilingual.tsx",
      "sha256": "7f595bc46a4e9b64acdbfc639000dfb88b117f0b1d104f09757ac292ab83844b"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/app/layout.tsx",
      "sha256": "6b6843783833be8920ea3b51582e60564a090211852203eca817bcf6ade5d9dc"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/content/en-CA/contact-form-web3forms.yaml",
      "sha256": "930837848b01a7aae37d2c00216fffed5c4aaa39a46718b20b64765c876cd542"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/content/fr-CA/contact-form-web3forms.yaml",
      "sha256": "1fd8d11410710501cf762345505ac00387fd6760f55b509efb01bbce2fab6d65"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/contact-content-source.d.ts",
      "sha256": "83dbabad219f52e630297da455e369b4e3752682f1e228ab6de81dad1cb588f8"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/contact-content.ts",
      "sha256": "7a59b22252358ba05701af9bd201773111eeeae56575d47c9a426f5fd6481273"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/contact-form-placement.tsx",
      "sha256": "48219f45ed847e857c2965bff7c0a8ef958ea52fe045045b00a4b04bcd1a9017"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/contact-form.tsx",
      "sha256": "82fb13aa30ce4abc4eec404dd45a2e1969cbcdc8f9388a998ff564371b401319"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/contact-settings.ts.template",
      "sha256": "4710a36ba3ca42ced6c7f25c0eacd1b6cfa8b49d54e7637827ee44aca7962686"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/hcaptcha.tsx",
      "sha256": "1c72303ebfa689c92e036d1a1709cd387ba5a40ccd6e8dbcf8355ba64c573a97"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/submit-contact.ts",
      "sha256": "eaa3c87bf80473a100ad934717bc45042734843a29c5fc30c4079f8c1f019bd4"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/src/integrations/contact-form-web3forms/web3forms-contact.tsx",
      "sha256": "07504fd91518dd161d5de072a7170a539ade458adc14e71c140f5567afa164ac"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/tests/component/web3forms-contact.test.tsx",
      "sha256": "093f0cecd6371e39cd38fd5bf8fdacfa8246bd75eb3be085060eaa2ef636625a"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/tests/e2e/web3forms-contact.spec.ts",
      "sha256": "725d6729209cdffde22d1163acbb7a5db4eeaae953362aef969ce24afdb6b3fb"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/apps/web/tests/unit/web3forms-contact.test.ts",
      "sha256": "e406b960d726de6b92d2c5739d03351bb6bb79c1bde0c6238f10817af42da280"
    },
    {
      "path": "packages/builder-core/templates/contact-form-web3forms/docs/contact-form-web3forms.md",
      "sha256": "ba53bb0e0f464405f863528d02ecf8a95308bf8cc77334435cbae4f8ededc0a3"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/application-persistence/.github/workflows/deploy.yml.template",
      "sha256": "4eb36134e10f5874f524166fdddf6df3b2cb817f4907e73af32dbeecdbbf17d5"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/application-persistence/apps/web/scripts/check-application-database.mjs.template",
      "sha256": "100e2011b6cfbc36aa417bec742a09b7afb35ba873302e563d22ff7660818ad8"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/application-persistence/apps/web/wrangler.jsonc.template",
      "sha256": "5920fd421aba54a295239a728b88c8aa906d18409cfd5df5fc134e1fd378958d"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/apps/web/vitest.bindings.config.ts",
      "sha256": "ce180380b3a00b5f9017706a632f1aad19c5cf800816db9989f223e8838fba8f"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/background-job-delivery/.github/workflows/deploy.persistence.yml.template",
      "sha256": "be346cfa7770ade7dc81eb60d409996108ef626bab5dab6a516548e900bd3314"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/background-job-delivery/.github/workflows/deploy.yml.template",
      "sha256": "f32c9bc34431caf9a2d373d31a8a53cd51d40c204769cd1fb8d03a07e20022ad"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/background-job-delivery/apps/web/scripts/check-job-delivery.mjs",
      "sha256": "13051c248bda2bbee74f2dac53bcda3975b683f6ab8ae3f9a094df7b7a9a8582"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/background-job-delivery/apps/web/worker.mjs",
      "sha256": "e5076627c5271df773e40888d12c09df1fd8f89aa580b69c1f3b00f01cb63c05"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/background-job-delivery/apps/web/wrangler.jsonc.template",
      "sha256": "c12be4c0b751734367cb533ff7230f6c297e21b8ccf324bbdc15faa9861c0dcf"
    },
    {
      "path": "packages/builder-core/templates/deployment-cloudflare/background-job-delivery/apps/web/wrangler.persistence.jsonc.template",
      "sha256": "736f22c6f1ac726c1b960472543842da348fd4baa160218cda43fa6a7905bad1"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/app/[locale]/[[...segments]]/page.tsx",
      "sha256": "1c61c9532dec151912086eb40d37d39b3a17044e06ece7557c332b6670668933"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/app/[locale]/layout.tsx",
      "sha256": "3c208425b9e26de76c8ad7947365148d21fc9be9e244f3e7272b8b28e9bc1474"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/app/[locale]/not-found.tsx",
      "sha256": "bb541e12aa225c11eb339ee03aa253df647152e694e0273e20a1195767454548"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/app/error.tsx",
      "sha256": "bf74f7f8d3604e1b0b0a9c046b668d566d25aff1536da4af627ca79c0e24f249"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/app/layout.tsx",
      "sha256": "d15cae2b36eedc3fcbc2a4bbf89bd302a7e2bdfad5213aca316dfd95aa366289"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/middleware.ts",
      "sha256": "a887a7638eac146dca2d4d9f9dac1c97bf2b2046a5459b63270d251a2fc09c3f"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/src/i18n/locale.ts",
      "sha256": "db3e47d4d623bca9394784aeebc969b727b2b09932fd1ced1313df03914f8f05"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/src/i18n/localized-content.ts",
      "sha256": "9ceb6daf5309268a17b95ad2e36a935db2219610021abacef15a7ea294fa2665"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/src/i18n/read-localized-content.ts",
      "sha256": "5523c98f7f6b52b9532eb632a6416b5bccccddcc070a4f0a5f7639cbb73924c5"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/src/integrations/booking/localized-booking.calendly.tsx",
      "sha256": "665997edf32e1a1f63afafdc20a9e98ffbe38148c1f3ae0b3a330583c8b632d9"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/src/integrations/booking/localized-booking.stub.tsx",
      "sha256": "33b8b3824d75da91562ba3c0ee163b1f52c8f0ce45cc94acb370160e976f1153"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/src/presentation/localized-page.tsx",
      "sha256": "3cd5c264569687a6e0e012cff8e87dd99ddd65cba31d0a495df2ce2dd56a59cd"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/tests/component/multilingual-page.test.tsx",
      "sha256": "393aa73277ba56817276f71c78131ea2bd0f54cf21860dd0319df8371fbe6ff7"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/tests/e2e/multilingual-routing.spec.ts",
      "sha256": "3c2b1e030b81830a14d70f09d23e9aac29ad08bf245a8e557a76361e2d369715"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/tests/unit/locale.test.ts",
      "sha256": "691936526a59b7671a127aafecf9fdabbd10ce41cf236d32aa7731e7f547212b"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/tests/unit/localized-content.test.ts",
      "sha256": "8b5bfa2f92ea194e18bf33c1297af6df097c8f705e7e727a15c2cd94842b74f5"
    },
    {
      "path": "packages/builder-core/templates/multilingual/apps/web/tests/visual/home-visual.spec.ts",
      "sha256": "e7c4c5eee40cc098e4dc27e1ef06daf3341f33018151281edee5a5e982996041"
    },
    {
      "path": "packages/builder-core/templates/multilingual/portfolio/apps/web/content/en-CA/localized-content.yaml.template",
      "sha256": "beb1348ec37e015f6d97c65bef982a6b9779c4b182f724ac036239518ed54b22"
    },
    {
      "path": "packages/builder-core/templates/multilingual/portfolio/apps/web/content/fr-CA/localized-content.yaml.template",
      "sha256": "b6aba3526e295e96d99e015ab8969f4048ad30257c3e8025ecfe94cc7df8db22"
    },
    {
      "path": "packages/builder-core/templates/multilingual/portfolio/apps/web/src/i18n/localized-profile.ts",
      "sha256": "ba9350e993b534e09c42f1487b2146f17024a6ba0d443e6e75d8987d6e39db88"
    },
    {
      "path": "packages/builder-core/templates/multilingual/site/apps/web/app/sitemap.ts",
      "sha256": "063e15b846d3b2d64eb7661b0f9ad5dc60335d6f35c6e8f59aaff24982b7d44a"
    },
    {
      "path": "packages/builder-core/templates/multilingual/site/apps/web/content/en-CA/localized-content.yaml.template",
      "sha256": "b2db5d62e91816a6d5b52765fbe49874e19b29e6aaf8bf5b66c3ae3c2c35b0e5"
    },
    {
      "path": "packages/builder-core/templates/multilingual/site/apps/web/content/fr-CA/localized-content.yaml.template",
      "sha256": "e7968e8f80f8cfed23e9713f6b9d5a251d915b3e336276b57ac16f289bc21c4d"
    },
    {
      "path": "packages/builder-core/templates/multilingual/site/apps/web/src/i18n/localized-profile.ts",
      "sha256": "94a68f0f10ff72f72b4412a919ebb14641bb4a63a8557dfaa4ac52ab042c6e68"
    },
    {
      "path": "packages/builder-core/templates/multilingual/site/apps/web/tests/e2e/site-routing.spec.ts.template",
      "sha256": "8c5bac002c3842dc67e16b4ea05b1a1904057dee4f56761c98bace667ea3f69e"
    },
    {
      "path": "packages/builder-core/templates/portfolio/apps/web/content/en-CA/long-form/introduction.md.template",
      "sha256": "4f4d725f2e486d147fdfa9d69f4ba6d9310cf0b47856b528e0ac711664cefe13"
    },
    {
      "path": "packages/builder-core/templates/portfolio/apps/web/content/en-CA/site.yaml.template",
      "sha256": "8538743fb17d4e0c44977c45c14ccc1a9ce47e36188d70d53178ebd30ef11447"
    },
    {
      "path": "packages/builder-core/templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
      "sha256": "75d3f59fe7171ac4709bbebbd69d86eba1b153995ca6e15865277a990d2e7e55"
    },
    {
      "path": "packages/builder-core/templates/portfolio/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
      "sha256": "455d1c659e0e8cad261dc590b5eaf4c68e1e091240be038a4f5f5a20a551e395"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/about/page.tsx",
      "sha256": "42b9a5777cd82f9ddedab4f5e82ea23cc2ae3dcce22d05e5e8deb1ce05d7ce7c"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/about/production-page.tsx",
      "sha256": "639171f5b67d74acb8b1c8ee5886285f0441c75a2d98eb4b7d94378300a22d54"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/not-found.tsx",
      "sha256": "cf31de6de404c8b2c140d3429a219c9a681f4307c3f19485676f0aa4c6c24337"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/page-with-booking.tsx",
      "sha256": "b14bc2c2db4f19be44ac1f0f1b901844545bb3174862cd0b561eacb03db9e7e1"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/page.tsx",
      "sha256": "5a8e69d58a8f32818f68e91e6d1815b04d44ce909e391245e980422ee7d2cfa9"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/robots.ts",
      "sha256": "eaefccadfa25577374cece3d88d34a14adc281046f65eb6296388512e8e73a45"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/sitemap.ts",
      "sha256": "59e48bad4ef7e42344057382cfa0352864cfaa80dc12a9eb59dbf0fd64d308a5"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/work/error.tsx",
      "sha256": "74dac5954dec142c19ab5e837655875f2bb5582cd793679c4596d665e4b9321c"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/work/featured/page.tsx",
      "sha256": "0f5ecaaff1b3794d0fdce1865bdb8a1d80e721e3b1afe27344bdf8c0a4b952b0"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/app/work/page.tsx",
      "sha256": "19f511d2a798724ff35d935743b4720c79c63d4883f0b239c22dcbddfc1916f5"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/about.production.yaml.template",
      "sha256": "33309063be899f2fc636ece1110b3f6fdd9325e5c96cbdf3eb5b635898bfdf26"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/about.yaml.template",
      "sha256": "da0b64a7e507af85066af37d6fc7292e296d87590305ec2c7d71b5fa0db2a857"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/long-form/introduction.md.template",
      "sha256": "3823a70cb551b8a4627fa2ef67903fbe1cb672ce8a56e84e2860c78125b1385c"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/not-found.yaml.template",
      "sha256": "6b128e47d783c9cbff20fea5b0cf1b992edd2008934250ddede992313dfac4ca"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/routing.yaml",
      "sha256": "43a2836aef1d37c9d2e43b8ba39cce466fad65873c303c810d00bf3fa6010393"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/site.production.yaml.template",
      "sha256": "6eeb68ef043937b63880e45e2d1379b208e159b68646baaeb47050879751eb85"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/site.yaml.template",
      "sha256": "e02d878e7131ef472c3c69da29c0fc9e6318fd22eadd6cbdbfd74edcb65ba5fb"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/content/en-CA/work-featured.yaml.template",
      "sha256": "c9d7438159d6646f39a7dc96c0adb07e6d3e316b48c8d83f10856476c4f7e406"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/src/routing/read-routing-content.ts",
      "sha256": "1a0ba418c242837cfc63b7d3226f8fcdfe9c6994d945fe88db34a232b6c954c9"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/src/routing/routing-content-schema.ts",
      "sha256": "ce8f178e035a9571b434ebd526295217dfd20baa4bdece4affe26737ed49f3e3"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/src/routing/site-page.tsx",
      "sha256": "79a0722274b461256e450c4406fd068d6dab60e28dc6b7cfaa4fc7a00fc2cb72"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/tests/component/site-page.test.tsx",
      "sha256": "e241fffe579bb264830a927f258fb4ec287b42e86cd1452e4dab950d90e2c90c"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/tests/e2e/site-routing.spec.ts.template",
      "sha256": "0aca29aa63e85bd079feba0a30e3755bd64a899d0cfbc27c440c1902bbf362cf"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/tests/unit/routing-content.test.ts",
      "sha256": "96a753f48540d23a52452bf1114c957af8b7c037c56373e05ae4ec8d77e1aaa5"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-desktop-chromium-linux.png",
      "sha256": "0af7b83955d5e5cd92c9a41e2025688149f5145ae572959ec8700ca644d7bce7"
    },
    {
      "path": "packages/builder-core/templates/site/apps/web/tests/visual/home-visual.spec.ts-snapshots/home-mobile-chromium-linux.png",
      "sha256": "c2845499229e8ab193ea0ff867a5edb0b98284e41e9da5e1272f0c8f10c2e6e6"
    },
    {
      "path": "packages/builder-core/templates/standards/application-persistence/.github/workflows/quality.yml.template",
      "sha256": "2dc8288141da88eefabf01da6ab8dceb30c5d96c7a7162b6a6a5568bd6c6f1eb"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/src/application/transactional-email-sender.ts",
      "sha256": "ba8cc264da5c946c5b81dc8d5ff1a2228670c1741f80ad92b47dd6874222581f"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/src/composition/server-transactional-email.ts",
      "sha256": "3f8e6c3a0d95ffad0aea96e134352128692d2a8cc14b3de577ee018888ac54e2"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/src/infrastructure/cloudflare/transactional-email-configuration.ts",
      "sha256": "61c0f64f487fc3728f2dd386d076973bd147c2ef91d397353500b0a403c290d6"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/src/infrastructure/observability/transactional-email-events.ts",
      "sha256": "2fd062e4fc57443ff091eab0cc7ae92a6220381abce71e5214e163a3665592ce"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/src/infrastructure/resend/transactional-email-sender.ts",
      "sha256": "69cc127fb11eef64bd325fcfe05cffa591b74bf2116018301cfce6e2cc4a648e"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/tests/unit/resend-transactional-email-sender.test.ts",
      "sha256": "a6058c882fbd3bba8e53c3c45fd5297784040f8c757ac3f612a44456c8eb2329"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/tests/unit/server-transactional-email.test.ts",
      "sha256": "0a39eb05e944ec845dc1b61365718256852d42d17433e51c174f7cca08c8d980"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/apps/web/tests/unit/transactional-email-events.test.ts",
      "sha256": "d9560968101ad607265690af07557cf130f3288521bfa71a161f9579c52f8292"
    },
    {
      "path": "packages/builder-core/templates/transactional-email-resend/docs/transactional-email.md",
      "sha256": "3cc8521d4671eb5ab79b038f7c904a49454db8fb9b4670ef7b359e0e47b76eb7"
    },
    {
      "path": "packages/builder-core/tsconfig.json",
      "sha256": "70ea82efb3c3b07bded98947a6fa516bb97a9b666db0c347e6ccfbedef971c9c"
    },
    {
      "path": "pnpm-lock.yaml",
      "sha256": "f9c78e1734ccf227c3748c61299c86cb7d9bd463f10212cc1b83109aa711d0c7"
    },
    {
      "path": "pnpm-workspace.yaml",
      "sha256": "ee5e48565ddec4675c098726579e4898907ca56421fd22fc77b981d889b94b54"
    },
    {
      "path": "scripts/dependency-audit-exception.json",
      "sha256": "eedd0ddf529899a71bfd87724f2d73331a1bf315651aa605b7e4c7485241d816"
    },
    {
      "path": "scripts/lib/dependency-audit.mjs",
      "sha256": "89a3e15c903cc59bd2f392ffdf72fa3ad18b253cfea2746a174e7f4e33073236"
    },
    {
      "path": "scripts/lib/isolated-process.mjs",
      "sha256": "d67643cbf27a82901196fdb3fb973b9a4efa32b2e4105d1cd36a9e493cb731da"
    },
    {
      "path": "scripts/verify-app-transition-visuals.mjs",
      "sha256": "7b4298da7def715e7ee0ff83824397da77c692eb3d05779be8ad054eaa47a63c"
    }
  ],
  "bridgeSourceFiles": {
    "packages/builder-core/src/lifecycle/app-profile-transition.ts": "4f3160334bea9796487b16d3158a0e9c623943cb4027dbc0edbc983a03a03d64",
    "scripts/verify-app-transition-visuals.mjs": "24ed484f193f698fc5d252202e6ac0338ff7ed358565377d5d83fb2141d24bb1"
  }
});

function verifyAppTransitionVisualInputIdentity(input) {
  if (input === null || typeof input !== "object" || !Array.isArray(input.optionalCapabilities) ||
      [...input.optionalCapabilities].some(identifier => !["analytics", "booking-calendly", "multilingual"].includes(identifier)) ||
      new Set(input.optionalCapabilities).size !== input.optionalCapabilities.length) return undefined;
  const optionalCapabilities = [...input.optionalCapabilities].sort();
  const key = optionalCapabilities.join("+") || "none";
  if (!Object.hasOwn(record.subsets, key) || input.influencingFingerprint !== record.subsets[key] ||
      input.targetLockfileFingerprint !== record.targetLockfileFingerprint) return undefined;
  const expectedBaselines = record.baselines[optionalCapabilities.includes("multilingual") ? "multilingual" : "monolingual"];
  if (input.baselineFingerprints !== undefined) {
    if (!Array.isArray(input.baselineFingerprints) || input.baselineFingerprints.length !== baselinePaths.length ||
        baselinePaths.some((path, index) => {
          const matching = input.baselineFingerprints.filter(file => file !== null && typeof file === "object" && file.path === path);
          return matching.length !== 1 || matching[0].fingerprint !== expectedBaselines[index];
        })) return undefined;
  }
  return { optionalCapabilities, expectedBaselines };
}

module.exports = Object.freeze({ record, baselinePaths, verifyAppTransitionVisualInputIdentity });
