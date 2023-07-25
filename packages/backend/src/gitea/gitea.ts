import {
  getGiteaRequestOptions,
  getGiteaFileContentsUrl,
  GiteaIntegration,
  ScmIntegrations,
} from '@backstage/integration';
import { ReadUrlOptions, ReadUrlResponse } from './types';
import {
  ReaderFactory,
  ReadTreeResponse,
  ReadTreeResponseFactory,
  ReadTreeOptions,
  SearchResponse,
  UrlReader,
} from './types';
import fetch, { Response } from 'node-fetch';
import { ReadUrlResponseFactory } from './ReadUrlResponseFactory';
import { RestEndpointMethodTypes } from '@octokit/rest';
import {
  AuthenticationError,
  NotFoundError,
  NotModifiedError,
} from '@backstage/errors';
import { Readable } from 'stream';
import { parseLastModified } from './util';
import parseGitUrl from 'git-url-parse';

export type GhRepoResponse =
  RestEndpointMethodTypes['repos']['get']['response']['data'];
export type GhCombinedCommitStatusResponse =
  RestEndpointMethodTypes['repos']['getCombinedStatusForRef']['response']['data'];
export type GhTreeResponse =
  RestEndpointMethodTypes['git']['getTree']['response']['data'];
export type GhBlobResponse =
  RestEndpointMethodTypes['git']['getBlob']['response']['data'];

/**
 * Implements a {@link @backstage/backend-plugin-api#UrlReaderService} for the Gitea v1 api.
 *
 * @public
 */
export class GiteaUrlReader implements UrlReader {
  static factory: ReaderFactory = ({ config, treeResponseFactory }) => {

    return ScmIntegrations.fromConfig(config)
      .gitea.list()
      .map(integration => {
        const reader = new GiteaUrlReader(integration, {treeResponseFactory});
        const predicate = (url: URL) => {
          return url.host === integration.config.host;
        };
        return { reader, predicate };
      });
  };

  constructor(private readonly integration: GiteaIntegration, private readonly deps: {
      treeResponseFactory: ReadTreeResponseFactory;
    },) {}

  async read(url: string): Promise<Buffer> {
    const response = await this.readUrl(url);
    return response.buffer();
  }

  async readUrl(
    url: string,
    options?: ReadUrlOptions,
  ): Promise<ReadUrlResponse> {
    let response: Response;
    const blobUrl = getGiteaFileContentsUrl(this.integration.config, url);
    try {
      response = await fetch(blobUrl, {
        method: 'GET',
        ...getGiteaRequestOptions(this.integration.config),
        signal: options?.signal as any,
      });
    } catch (e) {
      throw new Error(`Unable to read ${blobUrl}, ${e}`);
    }

    if (response.ok) {
      // Gitea returns an object with the file contents encoded, not the file itself
      const { encoding, content } = await response.json();

      if (encoding === 'base64') {
        return ReadUrlResponseFactory.fromReadable(
          Readable.from(Buffer.from(content, 'base64')),
          {
            etag: response.headers.get('ETag') ?? undefined,
            lastModifiedAt: parseLastModified(
              response.headers.get('Last-Modified'),
            ),
          },
        );
      }

      throw new Error(`Unknown encoding: ${encoding}`);
    }

    const message = `${url} could not be read as ${blobUrl}, ${response.status} ${response.statusText}`;
    if (response.status === 404) {
      throw new NotFoundError(message);
    }

    if (response.status === 304) {
      throw new NotModifiedError();
    }

    if (response.status === 403) {
      throw new AuthenticationError();
    }

    throw new Error(message);
  }

  async readTree(
    url: string,
    options?: ReadTreeOptions,
  ): Promise<ReadTreeResponse> {
    const urlArray = url.split('/');
    const team = urlArray[3]
    const repo = urlArray[4];
    const repoDetails = await this.getRepoDetails(`${this.integration.config.baseUrl}/api/v1/repos/${team}/${repo}/commits?access_token=${this.integration.config.password}`, team, repo);
    const commitSha = repoDetails.commitSha;

    if (options?.etag && options.etag === commitSha) {
      throw new NotModifiedError();
    }

    const { filepath } = parseGitUrl(url);
    const {headers} = getGiteaRequestOptions(this.integration.config);

    return this.doReadTree(
      team,
      repo,
      commitSha,
      filepath,
      // TODO(freben): The signal cast is there because pre-3.x versions of
      // node-fetch have a very slightly deviating AbortSignal type signature.
      // The difference does not affect us in practice however. The cast can be
      // removed after we support ESM for CLI dependencies and migrate to
      // version 3 of node-fetch.
      // https://github.com/backstage/backstage/issues/8242
      { headers, signal: options?.signal as any },
      {etag: commitSha},
    );
  }
  search(): Promise<SearchResponse> {
    throw new Error('GiteaUrlReader search not implemented.');
  }

  toString() {
    const { host } = this.integration.config;
    return `gitea{host=${host},authed=${Boolean(
      this.integration.config.password,
    )}}`;
  }

  private async doReadTree(
    team: string,
    repo: string,
    sha: string,
    subpath: string,
    init: RequestInit,
    options?: ReadTreeOptions,
  ): Promise<ReadTreeResponse> {
    // archive_url looks like "https://api.github.com/repos/owner/repo/{archive_format}{/ref}"
    const archive = await this.fetchResponse(
      `${this.integration.config.baseUrl}/api/v1/repos/${team}/${repo}/archive/master.tar.gz?access_token=${this.integration.config.password}`,
      init,
    );

    console.log(subpath)
    console.log(options)

    return await this.deps.treeResponseFactory.fromTarArchive({
      // TODO(Rugvip): Underlying implementation of fetch will be node-fetch, we probably want
      //               to stick to using that in exclusively backend code.
      stream: Readable.from(archive.body),
      etag: sha,
    });
  }

  private async getRepoDetails(url: string, team: string, repo: string): Promise<{
    commitSha: string;
    repo: {
      html_url: string;
      trees_url: string;
    };
  }> {
    const {headers} = getGiteaRequestOptions(this.integration.config);
    const commitStatus = await this.fetchJson(
      url,
      { headers },
    );

    return {
      commitSha: commitStatus[0].sha,
      repo: {
        trees_url: '',
        html_url: `https://${this.integration.config.baseUrl}/${team}/${repo}`
      },
    };
  }

  private async fetchResponse(
    url: string | URL,
    init: RequestInit,
  ): Promise<Response> {
    const urlAsString = url.toString();
    // @ts-ignore
    const response = await fetch(urlAsString, init);

    if (!response.ok) {
      const message = `Request failed for ${urlAsString}, ${response.status} ${response.statusText}`;
      if (response.status === 404) {
        throw new NotFoundError(message);
      }
      throw new Error(message);
    }

    return response;
  }

  private async fetchJson(url: string | URL, init: RequestInit): Promise<any> {
    const response = await this.fetchResponse(url, init);
    return await response.json();
  }
}