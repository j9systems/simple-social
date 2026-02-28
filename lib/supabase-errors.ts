type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

export function isMissingFullNameColumnError(error: SupabaseErrorLike | null | undefined) {
  if (!error) {
    return false;
  }

  const text = [error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (text.includes("full_name") && (text.includes("column") || text.includes("schema cache"))) {
    return true;
  }

  // PostgREST schema cache or Postgres undefined column.
  if (error.code === "PGRST204" || error.code === "42703") {
    return text.includes("full_name") || text.includes("profiles");
  }

  return false;
}
