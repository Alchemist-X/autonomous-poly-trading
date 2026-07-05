/**
 * RFC 6455 WebSocket frame codec for the Raven Delta news-impact hub.
 *
 * Encoders produce unmasked server-to-client frames (RFC 6455 section 5.1:
 * servers MUST NOT mask). The reader parses client-to-server frames, which
 * are always masked, and unmasks them. The reader buffers partial data across
 * TCP chunks, so callers get complete frames only — never header fragments.
 */

export const OPCODE = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  BINARY: 0x2,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
} as const;

const FIN_BIT = 0x80;
const MASK_BIT = 0x80;
const LENGTH_FIELD_16_BIT = 126;
const LENGTH_FIELD_64_BIT = 127;
const MASK_KEY_BYTES = 4;
// RFC 6455 section 5.5: control-frame payloads are capped at 125 bytes.
const MAX_CONTROL_PAYLOAD_BYTES = 125;

/** Default cap on bytes buffered while waiting for a complete frame. */
export const DEFAULT_MAX_BUFFERED_BYTES = 1_048_576;

export interface ParsedFrame {
  opcode: number;
  fin: boolean;
  payload: Buffer;
}

/**
 * Emitted (once, as the last event) when the reader exceeds its buffer cap or
 * a single frame declares a payload larger than the cap. The reader is dead
 * afterwards; the server should drop the client.
 */
export interface FrameReaderOverflow {
  error: "overflow";
}

export type FrameReaderEvent = ParsedFrame | FrameReaderOverflow;

export interface FrameReader {
  push(chunk: Buffer): FrameReaderEvent[];
}

export function isOverflow(event: FrameReaderEvent): event is FrameReaderOverflow {
  return "error" in event;
}

/** Build a single unmasked FIN frame around a payload. */
function encodeFrame(opcode: number, payload: Buffer): Buffer {
  if (payload.length < LENGTH_FIELD_16_BIT) {
    return Buffer.concat([Buffer.from([FIN_BIT | opcode, payload.length]), payload]);
  }
  if (payload.length <= 0xffff) {
    const header = Buffer.alloc(4);
    header[0] = FIN_BIT | opcode;
    header[1] = LENGTH_FIELD_16_BIT;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = FIN_BIT | opcode;
  header[1] = LENGTH_FIELD_64_BIT;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

/** Text frame. Length is the UTF-8 byte length, not the JS string length. */
export function encodeTextFrame(payload: string): Buffer {
  return encodeFrame(OPCODE.TEXT, Buffer.from(payload, "utf8"));
}

/** Close frame; `code` becomes a 2-byte big-endian status when provided. */
export function encodeCloseFrame(code?: number): Buffer {
  if (code === undefined) {
    return encodeFrame(OPCODE.CLOSE, Buffer.alloc(0));
  }
  const body = Buffer.alloc(2);
  body.writeUInt16BE(code, 0);
  return encodeFrame(OPCODE.CLOSE, body);
}

/** Pong frame; echoes at most 125 bytes of the Ping payload (control cap). */
export function encodePongFrame(payload?: Buffer): Buffer {
  return encodeFrame(OPCODE.PONG, (payload ?? Buffer.alloc(0)).subarray(0, MAX_CONTROL_PAYLOAD_BYTES));
}

/** Ping frame (used by the hub's heartbeat). */
export function encodePingFrame(payload?: Buffer): Buffer {
  return encodeFrame(OPCODE.PING, (payload ?? Buffer.alloc(0)).subarray(0, MAX_CONTROL_PAYLOAD_BYTES));
}

/** XOR a masked client payload against its 4-byte key into a fresh buffer. */
function unmask(masked: Buffer, maskKey: Buffer): Buffer {
  const output = Buffer.alloc(masked.length);
  for (let index = 0; index < masked.length; index += 1) {
    output[index] = masked[index] ^ maskKey[index % MASK_KEY_BYTES];
  }
  return output;
}

/**
 * Create a stateful incremental frame parser for one socket.
 *
 * `push(chunk)` appends raw TCP bytes and returns every frame that is now
 * complete (zero or more). Frames split across chunks and multiple frames in
 * one chunk are both handled. The parser state lives entirely inside this
 * closure — it is per-socket and never shared.
 */
export function createFrameReader(maxBufferedBytes: number = DEFAULT_MAX_BUFFERED_BYTES): FrameReader {
  let buffered = Buffer.alloc(0);
  let dead = false;

  /** Parse one frame off the front of `buffered`, if fully received. */
  function tryParseFrame(): ParsedFrame | "incomplete" | "overflow" {
    if (buffered.length < 2) return "incomplete";
    const fin = (buffered[0] & FIN_BIT) !== 0;
    const opcode = buffered[0] & 0x0f;
    const masked = (buffered[1] & MASK_BIT) !== 0;
    const lengthField = buffered[1] & 0x7f;

    let headerLength = 2;
    let payloadLength = lengthField;
    if (lengthField === LENGTH_FIELD_16_BIT) {
      headerLength += 2;
      if (buffered.length < headerLength) return "incomplete";
      payloadLength = buffered.readUInt16BE(2);
    } else if (lengthField === LENGTH_FIELD_64_BIT) {
      headerLength += 8;
      if (buffered.length < headerLength) return "incomplete";
      const declared = buffered.readBigUInt64BE(2);
      if (declared > BigInt(maxBufferedBytes)) return "overflow";
      payloadLength = Number(declared);
    }
    // A frame we could never buffer is an immediate overflow, even before the
    // payload bytes start arriving.
    if (payloadLength > maxBufferedBytes) return "overflow";

    const maskKeyOffset = headerLength;
    if (masked) headerLength += MASK_KEY_BYTES;
    const frameEnd = headerLength + payloadLength;
    if (buffered.length < frameEnd) return "incomplete";

    const rawPayload = buffered.subarray(headerLength, frameEnd);
    const payload = masked
      ? unmask(rawPayload, buffered.subarray(maskKeyOffset, maskKeyOffset + MASK_KEY_BYTES))
      : Buffer.from(rawPayload);
    buffered = buffered.subarray(frameEnd);
    return { opcode, fin, payload };
  }

  function markDead(): FrameReaderOverflow {
    dead = true;
    buffered = Buffer.alloc(0);
    return { error: "overflow" };
  }

  return {
    push(chunk: Buffer): FrameReaderEvent[] {
      if (dead) return [{ error: "overflow" }];
      buffered = Buffer.concat([buffered, chunk]);

      const events: FrameReaderEvent[] = [];
      for (;;) {
        const result = tryParseFrame();
        if (result === "incomplete") break;
        if (result === "overflow") {
          return [...events, markDead()];
        }
        events.push(result);
      }
      // Complete frames drained above; only an unparseable remainder counts
      // against the cap (e.g. an attacker trickling a never-ending header).
      if (buffered.length > maxBufferedBytes) {
        return [...events, markDead()];
      }
      return events;
    }
  };
}
