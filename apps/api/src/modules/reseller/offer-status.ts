export function isPublishedOffer(status: string) {
  return status === "PUBLISHED" || status === "ACTIVE";
}

export function isArchivedOffer(status: string) {
  return status === "ARCHIVED";
}
