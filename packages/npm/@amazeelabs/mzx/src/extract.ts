import { Code, Content } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const sanitize = (input: string) => {
  return input
    .replaceAll('\\', '\\\\')
    .replaceAll('$', '\\$')
    .replaceAll('`', '\\`')
    .replaceAll(/([A-Z][A-Z_]+)/g, "` + (process.env.$1 || '$1') + `");
};

export function preprocess(input: Array<CodeBlock>) {
  return input
    .map((block) => {
      // Search for `|-> [filename]` patterns. In this case, the code block
      // should be written to a file instead of being executed.
      const fileMatches = [
        ...block.content.matchAll(/([|>])->\s([^\s]+).*?\n?/gs),
      ];

      if (fileMatches.length === 1) {
        const content = block.content.replace(/.*?[|>]->.*\n*/g, '');
        const targetFile = fileMatches[0][2];
        return {
          lang: 'typescript',
          content: `await fs.writeFile(\`${sanitize(
            targetFile,
          )}\`, \`${sanitize(content)}\`);`,
        };
      }

      // A typescript block is returned as-is to be executed.
      if (block.lang === `typescript`) {
        return block;
      }

      // Shell blocks are transformed into a typescript block with an awaited
      // statement for each line in the command.
      if (block.lang === 'shell') {
        return {
          lang: `typescript`,
          content: block.content
            .split('\n')
            .map((line) => `await $\`${line}\`;`)
            .join('\n'),
        };
      }

      // Diff blocks try to patch the target file.
      if (block.lang === 'diff') {
        const diffMatches = [
          ...block.content.matchAll(/Index:\s(.+)\n=+\n?/gs),
        ];

        if (diffMatches.length === 1) {
          const file = sanitize(diffMatches[0][1]);
          const patch = sanitize(block.content);
          return {
            lang: 'typescript',
            content: `await patchFile(\`${file}\`, \`${patch}\`);`,
          };
        }
      }

      // If nothing matches, return undefined so the block is ignored during
      // execution;
      return undefined;
    })
    .filter(isDefined);
}

function isCodeBlock(content: Content): content is Code & { lang: string } {
  return content.type === 'code' && !!content.lang && !!content.value;
}

function isDefined<T extends any>(input: T | undefined): input is T {
  return typeof input !== 'undefined';
}

export type CodeBlock = {
  lang: string;
  content: string;
};

export function extractCodeBlocks(input: string): string {
  const root = unified().use(remarkParse).parse(input);
  return preprocess(
    root.children.filter(isCodeBlock).map((block) => ({
      lang: block.lang,
      content: block.value,
    })),
  )
    .filter(isDefined)
    .map((block) => block.content)
    .join('\n');
}
