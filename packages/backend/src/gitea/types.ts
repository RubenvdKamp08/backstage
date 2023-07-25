import { Readable } from 'stream';
import { Config } from '@backstage/config';
import {
  UrlReaderService,
  ReadTreeResponse,
  LoggerService,
} from '@backstage/backend-plugin-api';

export type {
  UrlReaderService as UrlReader,
  ReadTreeOptions,
  ReadTreeResponse,
  ReadTreeResponseDirOptions,
  ReadTreeResponseFile,
  ReadUrlResponse,
  ReadUrlOptions,
  SearchOptions,
  SearchResponse,
  SearchResponseFile,
} from '@backstage/backend-plugin-api';

/**
 * A predicate that decides whether a specific {@link @backstage/backend-plugin-api#UrlReaderService} can handle a
 * given URL.
 *
 * @public
 */
export type UrlReaderPredicateTuple = {
  predicate: (url: URL) => boolean;
  reader: UrlReaderService;
};

/**
 * A factory function that can read config to construct zero or more
 * {@link @backstage/backend-plugin-api#UrlReaderService}s along with a predicate for when it should be used.
 *
 * @public
 */
export type ReaderFactory = (options: {
  config: Config;
  logger: LoggerService;
  treeResponseFactory: ReadTreeResponseFactory;
}) => UrlReaderPredicateTuple[];

/**
 * An options object for {@link ReadUrlResponseFactory} factory methods.
 *
 * @public
 */
export type ReadUrlResponseFactoryFromStreamOptions = {
  etag?: string;
  lastModifiedAt?: Date;
};

/**
 * Options that control execution of {@link ReadTreeResponseFactory} methods.
 *
 * @public
 */
export type ReadTreeResponseFactoryOptions = {
  // A binary stream of a tar archive.
  stream: Readable;
  // If unset, the files at the root of the tree will be read.
  // subpath must not contain the name of the top level directory.
  subpath?: string;
  // etag of the blob
  etag: string;
  // Filter passed on from the ReadTreeOptions
  filter?: (path: string, info?: { size: number }) => boolean;
};

/**
 * Options that control {@link ReadTreeResponseFactory.fromReadableArray}
 * execution.
 *
 * @public
 */
export type FromReadableArrayOptions = Array<{
  /**
   * The raw data itself.
   */
  data: Readable;

  /**
   * The filepath of the data.
   */
  path: string;

  /**
   * Last modified date of the file contents.
   */
  lastModifiedAt?: Date;
}>;

/**
 * A factory for response factories that handle the unpacking and inspection of
 * complex responses such as archive data.
 *
 * @public
 */
export interface ReadTreeResponseFactory {
  fromTarArchive(
    options: ReadTreeResponseFactoryOptions,
  ): Promise<ReadTreeResponse>;
  fromZipArchive(
    options: ReadTreeResponseFactoryOptions,
  ): Promise<ReadTreeResponse>;
  fromReadableArray(
    options: FromReadableArrayOptions,
  ): Promise<ReadTreeResponse>;
}