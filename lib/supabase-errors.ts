type SupabaseErrorLike = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

function getErrorText(error: SupabaseErrorLike | null | undefined) {
  if (!error) {
    return "";
  }

  return [error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function isMissingColumnError(error: SupabaseErrorLike | null | undefined, columnName: string) {
  if (!error) {
    return false;
  }

  const text = getErrorText(error);
  if (text.includes(columnName) && (text.includes("column") || text.includes("schema cache"))) {
    return true;
  }

  // PostgREST schema cache or Postgres undefined column.
  if (error.code === "PGRST204" || error.code === "42703") {
    return text.includes(columnName);
  }

  return false;
}

export function isMissingTableError(error: SupabaseErrorLike | null | undefined, tableName: string) {
  if (!error) {
    return false;
  }

  const text = getErrorText(error);
  if (text.includes(tableName) && (text.includes("relation") || text.includes("schema cache"))) {
    return true;
  }

  // Postgres undefined table or PostgREST missing relation.
  return error.code === "42P01" || error.code === "PGRST205";
}

export function isMissingFullNameColumnError(error: SupabaseErrorLike | null | undefined) {
  if (!error) {
    return false;
  }

  if (isMissingColumnError(error, "full_name")) {
    return true;
  }

  const text = getErrorText(error);
  return (error.code === "PGRST204" || error.code === "42703") && text.includes("profiles");
}
