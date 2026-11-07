/** The field every ticked document is posted in – the document's place in the proposal's documents (ST-128). */
export const DOCUMENT_FIELD = "document";

/** The title and file category posted for the document at this place – a link's can be changed on the form. */
export const documentTitleField = (index: number) => `documentTitle-${index}` as const;
export const documentFileCategoryField = (index: number) => `documentFileCategory-${index}` as const;
