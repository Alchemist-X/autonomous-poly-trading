import OpengraphImage, {
  alt as ogAlt,
  size as ogSize,
  contentType as ogContentType
} from "./opengraph-image";

// Twitter card mirrors the OG composition. Route segment config has to be
// declared inline because Next 16 cannot statically parse re-exports.
export const runtime = "edge";
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default OpengraphImage;
