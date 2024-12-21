import { Buffer } from 'buffer';

export function isUtf16LE(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE;
}

export function isUtf16BE(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF;
}

export function removeBOM(buffer) {
  if (isUtf16LE(buffer) || isUtf16BE(buffer)) {
    return buffer.slice(2);
  }
  return buffer;
}

export function createBuffer(data) {
  return Buffer.from(data);
}