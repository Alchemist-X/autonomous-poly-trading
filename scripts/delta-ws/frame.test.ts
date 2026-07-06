import { describe, expect, it } from "vitest";
import {
  createFrameReader,
  encodeCloseFrame,
  encodePongFrame,
  encodeTextFrame,
  isOverflow,
  OPCODE
} from "./frame.ts";

// Build a masked client->server text frame the way a browser would (RFC 6455
// section 5.3). Only supports payloads under 126 bytes — enough for tests.
function maskedTextFrame(payload: string, maskKey: number[] = [0x12, 0x34, 0x56, 0x78]): Buffer {
  const data = Buffer.from(payload, "utf8");
  if (data.length >= 126) throw new Error("test helper only supports short payloads");
  const masked = Buffer.from(data.map((byte, index) => byte ^ maskKey[index % 4]));
  return Buffer.concat([Buffer.from([0x81, 0x80 | data.length]), Buffer.from(maskKey), masked]);
}

describe("encodeTextFrame: exact byte layout per payload length tier", () => {
  it("125 bytes stays in the 7-bit length field (2-byte header)", () => {
    const frame = encodeTextFrame("a".repeat(125));
    expect(frame.length).toBe(2 + 125);
    expect(frame[0]).toBe(0x81); // FIN + text opcode
    expect(frame[1]).toBe(125); // no mask bit, raw length
    expect(frame.subarray(2).toString("utf8")).toBe("a".repeat(125));
  });

  it("126 bytes switches to the 16-bit extended length (4-byte header)", () => {
    const frame = encodeTextFrame("b".repeat(126));
    expect(frame.length).toBe(4 + 126);
    expect(frame[0]).toBe(0x81);
    expect(frame[1]).toBe(126); // length field = 126 -> next 2 bytes hold the size
    expect(frame.readUInt16BE(2)).toBe(126);
    expect(frame.subarray(4).toString("utf8")).toBe("b".repeat(126));
  });

  it("65535 bytes is the last 16-bit length (4-byte header)", () => {
    const frame = encodeTextFrame("c".repeat(65535));
    expect(frame.length).toBe(4 + 65535);
    expect(frame[1]).toBe(126);
    expect(frame.readUInt16BE(2)).toBe(65535);
  });

  it("65536 bytes switches to the 64-bit extended length (10-byte header)", () => {
    const frame = encodeTextFrame("d".repeat(65536));
    expect(frame.length).toBe(10 + 65536);
    expect(frame[1]).toBe(127); // length field = 127 -> next 8 bytes hold the size
    expect(frame.readBigUInt64BE(2)).toBe(65536n);
  });

  it("uses UTF-8 byte length, not JS char length (the multi-byte bug)", () => {
    // 50 chars but 150 UTF-8 bytes: must pick the 16-bit tier, not 7-bit.
    const snowmen = "☃".repeat(50);
    const frame = encodeTextFrame(snowmen);
    expect(frame[1]).toBe(126);
    expect(frame.readUInt16BE(2)).toBe(150);
    expect(frame.subarray(4).toString("utf8")).toBe(snowmen);
  });
});

describe("encodeCloseFrame / encodePongFrame", () => {
  it("close with code 1000 is 0x88 0x02 + big-endian status", () => {
    expect([...encodeCloseFrame(1000)]).toEqual([0x88, 0x02, 0x03, 0xe8]);
  });

  it("close without a code has an empty payload", () => {
    expect([...encodeCloseFrame()]).toEqual([0x88, 0x00]);
  });

  it("pong echoes the ping payload", () => {
    expect([...encodePongFrame(Buffer.from("hi"))]).toEqual([0x8a, 0x02, 0x68, 0x69]);
    expect([...encodePongFrame()]).toEqual([0x8a, 0x00]);
  });
});

describe("createFrameReader: incremental masked-frame parsing", () => {
  it("round-trips a masked client frame (unmasked payload out)", () => {
    const reader = createFrameReader();
    const events = reader.push(maskedTextFrame("raven-delta"));
    expect(events).toHaveLength(1);
    const frame = events[0];
    if (isOverflow(frame)) throw new Error("unexpected overflow");
    expect(frame.opcode).toBe(OPCODE.TEXT);
    expect(frame.fin).toBe(true);
    expect(frame.payload.toString("utf8")).toBe("raven-delta");
  });

  it("buffers a frame split across two TCP chunks", () => {
    const reader = createFrameReader();
    const whole = maskedTextFrame("split across chunks");
    expect(reader.push(whole.subarray(0, 5))).toHaveLength(0); // mid-header/mask: nothing yet
    const events = reader.push(whole.subarray(5));
    expect(events).toHaveLength(1);
    const frame = events[0];
    if (isOverflow(frame)) throw new Error("unexpected overflow");
    expect(frame.payload.toString("utf8")).toBe("split across chunks");
  });

  it("yields both frames when two arrive in one chunk", () => {
    const reader = createFrameReader();
    const events = reader.push(Buffer.concat([maskedTextFrame("first"), maskedTextFrame("second")]));
    expect(events).toHaveLength(2);
    const payloads = events.map((event) => (isOverflow(event) ? "overflow" : event.payload.toString("utf8")));
    expect(payloads).toEqual(["first", "second"]);
  });

  it("parses an unmasked control frame (server-style close echo)", () => {
    const reader = createFrameReader();
    const events = reader.push(encodeCloseFrame(1000));
    expect(events).toHaveLength(1);
    const frame = events[0];
    if (isOverflow(frame)) throw new Error("unexpected overflow");
    expect(frame.opcode).toBe(OPCODE.CLOSE);
    expect(frame.payload.readUInt16BE(0)).toBe(1000);
  });

  it("flags overflow when a frame declares a payload beyond the cap, then stays dead", () => {
    const reader = createFrameReader(64);
    // Header declaring a 1000-byte payload against a 64-byte cap.
    const header = Buffer.from([0x81, 0x80 | 126, 0x03, 0xe8]);
    const events = reader.push(header);
    expect(events).toHaveLength(1);
    expect(isOverflow(events[0])).toBe(true);
    // Once overflowed the reader refuses everything, so the server drops the client.
    expect(reader.push(maskedTextFrame("late")).every(isOverflow)).toBe(true);
  });

  it("flags overflow when buffered incomplete bytes exceed the cap", () => {
    const reader = createFrameReader(32);
    // Masked frame declaring 30 payload bytes (under the 32-byte cap), so the
    // declared-length check passes; but header(2) + mask(4) + payload(30) = 36
    // total, and the buffer crosses the cap before the frame completes.
    const headerAndMask = Buffer.from([0x81, 0x80 | 30, 0x00, 0x00, 0x00, 0x00]);
    expect(reader.push(headerAndMask)).toHaveLength(0); // 6 bytes buffered, incomplete
    const events = reader.push(Buffer.alloc(28)); // 34 buffered > 32 cap, frame needs 36
    expect(events).toHaveLength(1);
    expect(isOverflow(events[0])).toBe(true);
  });
});
