export const canAll = (perms = [], ...needNames) => {
  if (!perms || !Array.isArray(perms)) return false;
  return needNames.every((n) => perms.includes(n));
};
export const canAny = (perms = [], ...needNames) => {
  if (!perms || !Array.isArray(perms)) return false;
  return needNames.some((n) => perms.includes(n));
};
