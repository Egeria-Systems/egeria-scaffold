import { z } from "zod";

const decimalSchema = z.string().regex(/^(?:0|[1-9][0-9]*)$/u);
const modeSchema = z.number().int().min(0).max(0o777);
const nameSchema = z.string().refine(
  (value) =>
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0"),
);
const canonicalBase64Schema = z.string().refine(
  (value) => Buffer.from(value, "base64").toString("base64") === value,
);

const serializedPathIdentitySchema = z.strictObject({
  device: decimalSchema,
  inode: decimalSchema,
});

const serializedFileIdentitySchema = z.strictObject({
  device: decimalSchema,
  inode: decimalSchema,
  mode: modeSchema,
  size: decimalSchema,
  changeTime: decimalSchema,
  modificationTime: decimalSchema,
});

const fileOperationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("create"),
    name: nameSchema,
    mode: modeSchema,
    content: canonicalBase64Schema,
  }),
  z.strictObject({
    kind: z.literal("remove"),
    name: nameSchema,
    identity: serializedFileIdentitySchema,
  }),
  z.strictObject({
    kind: z.literal("replace"),
    targetName: nameSchema,
    targetIdentity: serializedFileIdentitySchema,
    expected: canonicalBase64Schema,
    temporaryName: nameSchema,
    temporaryIdentity: serializedFileIdentitySchema,
  }),
  z.strictObject({
    kind: z.literal("delete"),
    targetName: nameSchema,
    targetIdentity: serializedFileIdentitySchema,
    expected: canonicalBase64Schema,
  }),
]);

export const fileOperationRequestSchema = z.strictObject({
  parent: serializedPathIdentitySchema,
  operation: fileOperationSchema,
});

const fileOperationFailureSchema = z.strictObject({
  ok: z.literal(false),
  sourceChanged: z.boolean(),
});
const createResultSchema = z.union([
  z.strictObject({ ok: z.literal(true), identity: serializedFileIdentitySchema }),
  fileOperationFailureSchema,
]);
const mutationResultSchema = z.union([
  z.strictObject({ ok: z.literal(true) }),
  fileOperationFailureSchema,
]);

export type SerializedFileIdentity = z.infer<
  typeof serializedFileIdentitySchema
>;
export type FileOperationRequest = z.infer<typeof fileOperationRequestSchema>;
export type FileOperation = FileOperationRequest["operation"];
export type FileOperationResult =
  | z.infer<typeof createResultSchema>
  | z.infer<typeof mutationResultSchema>;

export function parseFileOperationResult(
  kind: FileOperation["kind"],
  value: unknown,
): FileOperationResult | undefined {
  const schema = kind === "create" ? createResultSchema : mutationResultSchema;
  const result = schema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function serializeFileIdentity(
  identity: Readonly<{
    device: bigint;
    inode: bigint;
    mode: number;
    size: bigint;
    changeTime: bigint;
    modificationTime: bigint;
  }>,
): SerializedFileIdentity {
  return {
    device: identity.device.toString(),
    inode: identity.inode.toString(),
    mode: identity.mode,
    size: identity.size.toString(),
    changeTime: identity.changeTime.toString(),
    modificationTime: identity.modificationTime.toString(),
  };
}
