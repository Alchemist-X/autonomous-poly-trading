// Tiny className combinator. Filters out falsy values and joins the rest
// with spaces. Avoids pulling in clsx/classnames for a single helper.
export const cn = (...classes: Array<string | false | undefined | null>): string =>
  classes.filter(Boolean).join(" ");
