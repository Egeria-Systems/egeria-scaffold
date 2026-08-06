import { findSequencingLabels } from "../check-semantic-naming.mjs";

const reportMatches = (context, node, value) => {
  for (const match of findSequencingLabels(value)) {
    context.report({
      data: { label: match.value },
      messageId: "sequencingLabel",
      node,
    });
  }
};

export default {
  meta: {
    docs: {
      description:
        "Require software names to describe responsibility instead of implementation sequence.",
    },
    messages: {
      sequencingLabel:
        "Roadmap and implementation sequencing labels must not be used as software names.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      Identifier: (node) => reportMatches(context, node, node.name),
      JSXIdentifier: (node) => reportMatches(context, node, node.name),
      JSXText: (node) => reportMatches(context, node, node.value),
      Literal: (node) => {
        if (typeof node.value === "string") {
          reportMatches(context, node, node.value);
        }
      },
      PrivateIdentifier: (node) => reportMatches(context, node, node.name),
      Program: () => {
        for (const comment of context.sourceCode.getAllComments()) {
          reportMatches(context, comment, comment.value);
        }
      },
      TemplateElement: (node) =>
        reportMatches(context, node, node.value.raw),
    };
  },
};
