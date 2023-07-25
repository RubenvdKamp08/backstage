import { ConflictError } from '@backstage/errors';
import getRawBody from 'raw-body';
import { Readable } from 'stream';
import {
  ReadUrlResponse,
  ReadUrlResponseFactoryFromStreamOptions,
} from './types';

/**
 * Utility class for UrlReader implementations to create valid ReadUrlResponse
 * instances from common response primitives.
 *
 * @public
 */
export class ReadUrlResponseFactory {
  /**
   * Resolves a ReadUrlResponse from a Readable stream.
   */
  static async fromReadable(
    stream: Readable,
    options?: ReadUrlResponseFactoryFromStreamOptions,
  ): Promise<ReadUrlResponse> {
    // Reference to eventual buffer enables callers to call buffer() multiple
    // times without consequence.
    let buffer: Promise<Buffer>;

    // Prevent "stream is not readable" errors from bubbling up.
    const conflictError = new ConflictError(
      'Cannot use buffer() and stream() from the same ReadUrlResponse',
    );
    let hasCalledStream = false;
    let hasCalledBuffer = false;

    return {
      buffer: () => {
        hasCalledBuffer = true;
        if (hasCalledStream) throw conflictError;
        if (buffer) return buffer;
        buffer = getRawBody(stream);
        return buffer;
      },
      stream: () => {
        hasCalledStream = true;
        if (hasCalledBuffer) throw conflictError;
        return stream;
      },
      etag: options?.etag,
      lastModifiedAt: options?.lastModifiedAt,
    };
  }

  /**
   * Resolves a ReadUrlResponse from an old-style NodeJS.ReadableStream.
   */
  static async fromNodeJSReadable(
    oldStyleStream: NodeJS.ReadableStream,
    options?: ReadUrlResponseFactoryFromStreamOptions,
  ): Promise<ReadUrlResponse> {
    const readable = new Readable().wrap(oldStyleStream);
    return ReadUrlResponseFactory.fromReadable(readable, options);
  }
}