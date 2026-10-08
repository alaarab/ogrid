import { FormulaError, type ASTNode, type IFormulaContext } from './types';

/** Keep reference arguments as references, resolving # to its current geometry. */
export function resolveReference(node: ASTNode, context: IFormulaContext): ASTNode;
export function resolveReference(node: ASTNode | undefined, context: IFormulaContext): ASTNode | undefined;
export function resolveReference(node: ASTNode | undefined, context: IFormulaContext): ASTNode | undefined {
  if (node?.kind !== 'spillRef') return node;
  const range = context.getSpillRange?.(node.address) ?? new FormulaError('#REF!', 'Cell has no spill range');
  if (range instanceof FormulaError) throw range;
  return { kind: 'range', ...range, raw: '' };
}
