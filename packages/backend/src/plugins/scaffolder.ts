import { CatalogClient } from '@backstage/catalog-client';
import { createRouter, createBuiltinActions } from '@backstage/plugin-scaffolder-backend';
import { ScmIntegrations } from '@backstage/integration';
import { Router } from 'express';
import type { PluginEnvironment } from '../types';
import { createKubeDeployment, createKubeService, createServiceMonitorFile, publishGitea, updateApplicationWorkload, updatePipeline } from './scaffolder/actions/custom';

export interface GiteaConfig {
  host: string
  password: string
}

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const catalogClient = new CatalogClient({
    discoveryApi: env.discovery,
  });

  const integrations = ScmIntegrations.fromConfig(env.config);

  const builtInActions = createBuiltinActions({
    integrations,
    catalogClient,
    config: env.config,
    reader: env.reader,
  });

  const giteaIntegration : any = env.config.get('integrations.gitea');
  const giteaConfig: GiteaConfig = {
    ...giteaIntegration[0],
    host: `https://${giteaIntegration[0].host}`
  }
  
  const actions = [
    ...builtInActions,
    publishGitea(giteaConfig),
    updatePipeline(giteaConfig),
    createKubeDeployment(giteaConfig),
    createKubeService(giteaConfig),
    updateApplicationWorkload(giteaConfig),
    createServiceMonitorFile(giteaConfig)
  ];

  return await createRouter({
    actions,
    logger: env.logger,
    config: env.config,
    database: env.database,
    reader: env.reader,
    catalogClient,
    identity: env.identity,
    permissions: env.permissions,
  });
}
