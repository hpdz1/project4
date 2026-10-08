/** True when `pathname` is `href` or a page below it. Hash links are never "current". */
export function isCurrentPath(pathname: string | null, href: string): boolean {
  if (!pathname || href.includes("#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
