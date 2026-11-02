/**
 * Tokens per page or image indexed – what one costs at an embedding model, measured by the spike ST-105 with
 * `google/gemini-embedding-2` (2026-11-01): a page image 258 tokens, a PDF page's text passage 274 on average, so a PDF
 * page ≈ 530. One constant for both (ST-110): the PDF page's, so an image is rather over- than underestimated. In a file
 * of its own so that ST-110's scenario can state its own figure.
 */
export const TOKENS_PER_PAGE_OR_IMAGE = 530;
