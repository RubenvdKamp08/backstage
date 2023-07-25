# Golden path: create nestjs application

This golden path helps developers creating a NestJS application with all the necessary tools and configurations to focus on the development instead of the infrastructure. Here we explain how this golden path works.

## Input

The input for this golden path is only one parameter:
`application name`.

This application name has to be unique.

## Steps

This golden paths contains two steps: create repository and import catalog.

### 1. Create repository

Based on the golden path you selected it will create a new repository with the name you selected with the related template.

This template will contain all the necessary configurations and code to get started, including `.drone.yml` and `package.json`.

```
service-name/
    docs/
        index.md
    src/
        app.controller.spec.ts
        app.controller.ts
        app.module.ts
        app.service.ts
        exception.filter.ts
        main.ts
    test/
        app.e2e-spec.ts
        jest-e2e.json
    .drone.yml
    .estlintrc.js
    .gitignore
    .prettierrc
    catalog-info.yaml
    Dockerfile
    mkdocs.yml
    nest-cli.json
    package-lock.json
    package.json
    README.md
    tsconfig.build.json
    tsconfig.json
```

.drone.yml:
```yaml
---
kind: pipeline
type: kubernetes
name: build
steps:
  - name: yaml_validator
    image: devatherock/drone-yaml-validator:latest
    settings:
      debug: true
      continue_on_error: false
      allow_duplicate_keys: false
      ignore_unknown_tags: true
  - name: build-push
    image: plugins/docker
    settings:
      registry: harbor.134.209.138.125.nip.io
      repo: harbor.134.209.138.125.nip.io/team-admin/${REPO_NAME}
      insecure: true
      username:
        from_secret: REGISTRY_USERNAME
      password:
        from_secret: REGISTRY_PASSWORD
      tags:
        - ${${DRONE_BUILD_NUMBER}}
        - latest
```
The secrets will be automatically injected from DroneCI.

### 2. Import catalog

Together with the code and configurations for the pipeline the repository also contains a `catalog-info.yaml`, `mkdocs.yml` and `docs/` which will be imported into backstage to be available in the service catalog. This way the application is discoverable by Backstage and will include the documentation you can write inside the `docs/` folder.

## Output

The output of this golden path are the following three links:

1. Repository: link to the repository

2. DroneCI: link to sync the repository in droneCI

3. Catalog: link to the service in backstage catalog

