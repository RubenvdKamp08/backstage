# Deploy applications

After you have build an application and you want to deploy the application to the development or production environment, you have to make sure that the configurations are in place. In this guide we will explain how this can be done.

## Create dev workload

In order to get an application deployed to the development environment you can use a golden path that will configure the deployment of your application. In this golden path you need to give the name of the application and the platform will take of the rest. This golden path will do five steps. 

### 1. Create a deployment file

This platform uses ArgoCD to deploy applications to kubernetes and all the code is located in [this repository](https://gitea.134.209.138.125.nip.io/otomi/argo-workload). In order to give ArgoCD all the information necessary to deploy this application the platform created a deployment file, which could looks like:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: basic-service-dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: basic-service-dev
  template:
    metadata:
      annotations:
        policy.otomi.io/ignore-sidecar: container-limits,psp-allowed-users
      labels:
        app: basic-service-dev
    spec:
      containers:
        - name: basic-service
          image: harbor.134.209.138.125.nip.io/team-admin/basic-service:4
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
It will automatically fill in the correct names to make sure that the correct images and names are deployed. It will be located at `application-name-dev/deployment.yaml`


### 2. Create service file

The second step is to create a service file that is linked to the deployment this file will look like:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: basic-service-dev
spec:
  selector:
    app: basic-service-dev
  ports:
    - port: 80
      targetPort: 5000
```

By default all the provisioned applications will expose port 5000, so you don't have to change anything. It will be located at `application-name-dev/service.yaml`


### 3. Create servicemonitor file

The third step will be the creation of a servicemonitor file. This servicemonitor file is necessary expose the metrics to prometheus. This file will look like:
```yaml
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: basic-service-dev
  labels:
    app: basic-service-dev-metrics
    prometheus: system
spec:
  namespaceSelector:
    matchNames:
    - basic-service-dev
  selector:
    matchLabels:
      app: basic-service-dev
  endpoints:
  - targetPort: 5000
    path: /metrics
```
It will be located at `application-name-dev/servicemonitor.yaml`
### 4. Create applicationSet

After we have all the necessary configuration files we will have to create the applicationSet that will be used by argocd to deploy all the configuration files. The platform will add `application-name.yaml` to the root of the argo-workload repository and it contains the following configurations:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: basic-service
  namespace: argocd
spec:
  generators:
  - list:
      elements:
      - cluster: dev
        url: https://kubernetes.default.svc
  template:
    metadata:
      name: 'basic-service-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git
        targetRevision: HEAD
        path: 'basic-service-{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: 'basic-service-{{cluster}}'
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

### 5. Add CD pipeline

After we have configured ArgoCD to deploy the newly created application we can add a CD pipeline to our application to make sure that the deployment in kubernetes will be updated with the new image once we pushed new code. The following code will be added to the `.drone.yml` file in your repository:

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
      - sed -i 's/basic-service:.*/basic-service:'"${DRONE_BUILD_NUMBER}"'/g'
        ./basic-service-dev/deployment.yaml
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
      commit_message: Update basic-service-prod with docker image ${DRONE_BUILD_NUMBER}
      author_name: droneCI
      author_email: gitea@local.domain
depends_on:
  - build
```

This pipeline will update the tag of the deployment stated in the argo-workload repository to the latest tag and pushes the changes to the repository.

## Create prod deployment

For the prod deployment a lot of the things will work the same, the biggest difference is that the `deployment.yaml`, `service.yaml` and `servicemonitor.yaml` is located in the `application-name-prod` folder.

Moreover the applicationSet will be updated and the following configurations will be changed:
```yaml
generators:
  - list:
      elements:
      - cluster: dev
        url: https://kubernetes.default.svc
      - cluster: prod
        url: https://kubernetes.default.svc
```