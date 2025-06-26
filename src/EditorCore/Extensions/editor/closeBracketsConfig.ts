import { closeBrackets, CloseBracketConfig } from "@codemirror/autocomplete";
import { markdownLanguage } from "@codemirror/lang-markdown";

/**
 * Configuration for Markdown-specific bracket completion
 * Handles the following pairs:
 * - Parentheses: ()
 * - Square brackets: []
 * - Curly braces: {}
 * - Backticks: `` (for inline code)
 * - Triple backticks: ``` (for code blocks)
 * - Double asterisks: ** (for bold)
 * - Double underscores: __ (for bold alternative)
 * - Single asterisk: * (for italic)
 * - Single underscore: _ (for italic alternative)
 * - Double dollar signs: $$ (for LaTeX math)
 */
export const markdownCloseBrackets = markdownLanguage.data.of({
  closeBrackets: {
    brackets: ["(", "[", "{", "'", '"', "`", "```", "*", "**", "_", "__", "$", "$$"]
  }
});

/**
 * Extension to enable auto-closing brackets with our custom markdown configuration
 */
export const markdownBracketCompletion = [
  closeBrackets(),
  markdownCloseBrackets
]; 