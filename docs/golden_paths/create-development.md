# Golden path: create react application

This golden path helps developers creating the kubernetes and ArgoCD workload files needed to deploy an application to the development environment. Here we explain how this golden path works.

## Input

The input for this golden path is only one parameter:
`application name`.

This is the application name that you want to deploy.

## Steps

### 1. Add pipeline

First, the golden path will add a CD pipeline to our application to make sure that the deployment in kubernetes will be updated with the new image once we pushed new code. The following code will be added to the `.drone.yml` file in your repository:

```yaml
---
kind: pipeline
type: kubernetes
name: update-docker-dev
clone:
  disable: true
steps:
  - name: clone-workload
    image: plugins/git
    commands:
      - git clone https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git .
  - name: update-docker-tag
    image: alpine/git
    commands:
      - sed -i 's/${service-name}:.*/${service-name}:'"${DRONE_BUILD_NUMBER}"'/g'
        ./${service-name}-dev/deployment.yaml
  - name: git-config
    image: alpine/git
    commands:
      - git config --global user.name "Drone CI"
      - git config --global user.email "bot@drone.com"
  - name: git-push
    image: appleboy/drone-git-push
    settings:
      branch: master
      remote: https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git
      username:
        from_secret: GIT_USERNAME
      password:
        from_secret: GIT_PASSWORD
      force: true
      commit: true
      commit_message: Update ${service-name} with docker image ${DRONE_BUILD_NUMBER}
      author_name: droneCI
      author_email: gitea@local.domain
depends_on:
  - build
```

### 2. Create a deployment file

This platform uses ArgoCD to deploy applications to kubernetes and all the code is located in [this repository](https://gitea.134.209.138.125.nip.io/otomi/argo-workload). In order to give ArgoCD all the information necessary to deploy this application the golden path creates a deployment file, which could looks like:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service-name}-dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${service-name}-dev
  template:
    metadata:
      annotations:
        policy.otomi.io/ignore-sidecar: container-limits,psp-allowed-users
      labels:
        app: ${service-name}-dev
    spec:
      containers:
        - name: basic-service
          image: harbor.134.209.138.125.nip.io/team-admin/${service-name}:4
          ports:
            - containerPort: 5000
          resources:
            limits:
              memory: '64Mi'
              cpu: '100m'
            requests:
              memory: '64Mi'
              cpu: '100m'
          securityContext:
            runAsUser: 1001
```
It will automatically fill in the correct names to make sure that the correct images and names are deployed. It will be located at `${service-name}-dev/deployment.yaml`


### 3. Create service file

The third step is to create a service file that is linked to the deployment this file will look like:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ${service-name}-dev
spec:
  selector:
    app: ${service-name}-dev
  ports:
    - port: 80
      targetPort: 5000
```

By default all the provisioned applications will expose port 5000, so you don't have to change anything. It will be located at `${service-name}-dev/service.yaml`


### 4. Create servicemonitor file

The next step will be the creation of a servicemonitor file. This servicemonitor file is necessary expose the metrics to prometheus. This file will look like:
```yaml
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${service-name}-dev
  labels:
    app: ${service-name}-dev-metrics
    prometheus: system
spec:
  namespaceSelector:
    matchNames:
    - ${service-name}-dev
  selector:
    matchLabels:
      app: ${service-name}-dev
  endpoints:
  - targetPort: 5000
    path: /metrics
```
It will be located at `${service-name}-dev/servicemonitor.yaml`

### 5. Create applicationSet

After we have all the necessary configuration files the golden path will create the applicationSet that will be used by argocd to deploy all the configuration files. It will add `${service-name}.yaml` to the root of the argo-workload repository and it contains the following configurations:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: ${service-name}
  namespace: argocd
spec:
  generators:
  - list:
      elements:
      - cluster: dev
        url: https://kubernetes.default.svc
  template:
    metadata:
      name: '${service-name}-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git
        targetRevision: HEAD
        path: '${service-name}-{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: '${service-name}-{{cluster}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
          - PruneLast=true
          - ApplyOutOfSyncOnly=true
```
This applicationSet will retrieve the configuration files from the correct Gitea location since it is provisioned by the platform first.

## Output

1. GitOps repository: link to the argocd workload repository

2. ArgoCD service: link to argoCD services