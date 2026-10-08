/**
 * Inbound email: webhook normalization, forwarding helpers, classification
 * and carrier parsers. See docs/ARCHITECTURE.md ("src/lib/ingest").
 */
export { InboundPayloadError, MAX_BODY_CHARS, fromPostmark, fromRawJson } from "./normalize";
export { findInboundAlias, recoverOriginal, stripForwardPrefix, type OriginalMessage } from "./forwarding";
export { extractLinks, htmlToText } from "./html";
export { parseEmail, type ParseOptions } from "./parse";
export { parseForwardingVerification } from "./verification";
export { statusFromText } from "./status";
export { classifyEmail, classifySender } from "./classify";
export {
  SAMPLE_AMAZON_ORDER,
  SAMPLE_TIMEZONE,
  SAMPLE_TRACKING,
  SAMPLE_USER_EMAIL,
  sampleEmails,
  type SampleOptions,
} from "./samples";
