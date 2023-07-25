import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { createDeployment, createGiteaRepo, createService, manageDroneFile, manageWorkload, createServiceMonitor } from './helpers/gitea';
import { GiteaConfig } from '../../scaffolder';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

export const publishGitea = (config: GiteaConfig) => {
  return createTemplateAction<{ name: string; template: string }>({
    id: 'publish:gitea',
    schema: {
      input: {
        required: ['name', 'template'],
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'name',
            description: 'The name of the new repository',
          },
          template: {
            type: 'string',
            title: 'template',
          },
        },
      },
    },
    async handler(ctx) {
        const name = ctx.input.name.replace(/\s+/g, '-').toLowerCase();
        const template = `${ctx.input.template}-template`;
        await createGiteaRepo(config.host, config.password, name, template);
    },
  });
};

export const updatePipeline = (config: GiteaConfig) => {
  return createTemplateAction<{ name: string; environment: 'dev' | 'prod' }>({
    id: 'publish:pipeline',
    schema: {
      input: {
        required: ['name'],
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'name',
            description: 'The name of the new service',
          },
          environment: {
            type: 'string',
            title: 'environment',
            description: 'The environment for the deployment',
          },
        },
      },
    },
    async handler(ctx) {
        const name = ctx.input.name.replace(/\s+/g, '-').toLowerCase();
        const env = ctx.input.environment;
        await manageDroneFile(config.host, config.password, name, env);
    },
  });
};

export const createKubeDeployment = (config: GiteaConfig) => {
  return createTemplateAction<{ name: string; environment: 'dev' | 'prod' }>({
    id: 'publish:deployment',
    schema: {
      input: {
        required: ['name'],
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'name',
            description: 'The name of the new service',
          },
          environment: {
            type: 'string',
            title: 'environment',
            description: 'The environment for the deployment',
          },
        },
      },
    },
    async handler(ctx) {
        const name = ctx.input.name.replace(/\s+/g, '-').toLowerCase();
        const env = ctx.input.environment;
        await createDeployment(config.host, config.password, name, env);
    },
  });
};

export const createKubeService = (config: GiteaConfig) => {
  return createTemplateAction<{ name: string; environment: 'dev' | 'prod' }>({
    id: 'publish:service',
    schema: {
      input: {
        required: ['name'],
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'name',
            description: 'The name of the new service',
          },
          environment: {
            type: 'string',
            title: 'environment',
            description: 'The environment for the deployment',
          },
        },
      },
    },
    async handler(ctx) {
        const name = ctx.input.name.replace(/\s+/g, '-').toLowerCase();
        const env = ctx.input.environment;
        await createService(config.host, config.password, name, env);
    },
  });
};

export const updateApplicationWorkload = (config: GiteaConfig) => {
  return createTemplateAction<{ name: string; environment: 'dev' | 'prod' }>({
    id: 'publish:workload',
    schema: {
      input: {
        required: ['name'],
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'name',
            description: 'The name of the new service',
          },
          environment: {
            type: 'string',
            title: 'environment',
            description: 'The environment for the deployment',
          },
        },
      },
    },
    async handler(ctx) {
        const name = ctx.input.name.replace(/\s+/g, '-').toLowerCase();
        const env = ctx.input.environment;
        await manageWorkload(config.host, config.password, name, env);
    },
  });
};

export const createServiceMonitorFile = (config: GiteaConfig) => {
  return createTemplateAction<{ name: string; environment: 'dev' | 'prod' }>({
    id: 'publish:serviceMonitor',
    schema: {
      input: {
        required: ['name'],
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'name',
            description: 'The name of the new service',
          },
          environment: {
            type: 'string',
            title: 'environment',
            description: 'The environment for the deployment',
          },
        },
      },
    },
    async handler(ctx) {
        const name = ctx.input.name.replace(/\s+/g, '-').toLowerCase();
        const env = ctx.input.environment;
        await createServiceMonitor(config.host, config.password, name, env);
    },
  });
};