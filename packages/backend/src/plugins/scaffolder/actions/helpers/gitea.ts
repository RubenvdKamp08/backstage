import YAML from 'yaml';

const createContent = (data: any) : string => {
    const yamlBody = YAML.stringify(data);
    return JSON.stringify({content: Buffer.from(yamlBody).toString('base64')})
}

const sendRequest = async (url: string, method: string, body: any) => {
    try {
        const response = await fetch(url, {
            method, 
            headers: {
                'accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body
        })
        if (!response.ok) {
            return response;
        }
        return response;
    } catch (e) {
        return undefined;
    }
}

export const createGiteaRepo = async (baseUrl: string, accessToken: string, name: string, template: string) => {
    const url = `${baseUrl}/api/v1/repos/otomi-admin/${template}/generate?access_token=${accessToken}`
    const body = {
        "default_branch": "master",
        "git_content": true,
        "name": name,
        "owner": "otomi-admin",
        "private": true
    }
    
    await sendRequest(url, 'POST', JSON.stringify(body))
}

export const createService = async (baseUrl: string, accessToken: string, name: string, env: 'prod' | 'dev') => {
    const fullName = `${name}-${env}`
    const url = `${baseUrl}/api/v1/repos/otomi/argo-workload/contents/${fullName}/service.yaml?access_token=${accessToken}`
    const data = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": fullName,
            "labels": {
                "app": fullName
            }
        },
        "spec": {
            "selector": {
            "app": fullName
            },
            "ports": [
            {
                "port": 80,
                "targetPort": 5000
            }
            ]
        }
    }

    const body = createContent(data);
    
    await sendRequest(url, 'POST', body)
}

export const createDeployment = async (baseUrl: string, accessToken: string, name: string, env: 'prod' | 'dev') => {
    const fullName = `${name}-${env}`
    const url = `${baseUrl}/api/v1/repos/otomi/argo-workload/contents/${fullName}/deployment.yaml?access_token=${accessToken}`
    const data = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": fullName
        },
        "spec": {
            "replicas": 1,
            "selector": {
            "matchLabels": {
                "app": fullName
            }
            },
            "template": {
            "metadata": {
                "annotations": {
                "policy.otomi.io/ignore-sidecar": "container-limits,psp-allowed-users"
                },
                "labels": {
                "app": fullName
                }
            },
            "spec": {
                "containers": [
                {
                    "name": fullName,
                    "image": `harbor.134.209.138.125.nip.io/team-admin/${name}:latest`,
                    "ports": [
                    {
                        "containerPort": 5000
                    }
                    ],
                    "resources": {
                    "limits": {
                        "memory": "64Mi",
                        "cpu": "100m"
                    },
                    "requests": {
                        "memory": "64Mi",
                        "cpu": "100m"
                    }
                    },
                    "securityContext": {
                    "runAsUser": 1001
                    }
                }
                ]
            }
            }
        }
    }

    const body = createContent(data);
    
    await sendRequest(url, 'POST', body)
}

export const manageWorkload = async(baseUrl: string, accessToken: string, name: string, env: 'dev' | 'prod') => {
    const url = `${baseUrl}/api/v1/repos/otomi/argo-workload/contents/${name}.yaml?access_token=${accessToken}`

    let data: any;
    let type: string;

    if (env == 'dev') {
        type = 'POST'
        data = {
            "apiVersion": "argoproj.io/v1alpha1",
            "kind": "ApplicationSet",
            "metadata": {
            "name": name,
            "namespace": "argocd"
            },
            "spec": {
            "generators": [
                {
                "list": {
                    "elements": [
                    {
                        "cluster": "dev",
                        "url": "https://kubernetes.default.svc"
                    }
                    ]
                }
                }
            ],
            "template": {
                "metadata": {
                    "name": `${name}-{{cluster}}`
                },
                "spec": {
                "project": "default",
                "source": {
                    "repoURL": "https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git",
                    "targetRevision": "HEAD",
                    "path": `${name}-{{cluster}}`
                },
                "destination": {
                    "server": "{{url}}",
                    "namespace": `${name}-{{cluster}}`
                },
                "syncPolicy": {
                    "automated": {
                    "prune": true,
                    "selfHeal": true
                    },
                    "syncOptions": [
                    "CreateNamespace=true",
                    "PruneLast=true",
                    "ApplyOutOfSyncOnly=true"
                    ]
                }
                }
            }
            }
        }
        const body = createContent(data);
    
        await sendRequest(url, 'POST', body)
    } else {
        type = 'PUT'
        const res = await sendRequest(url, 'get', null)
        const resBody = await res?.json();
        let data = YAML.parse(Buffer.from(resBody.content, 'base64').toString());
        if (data.spec.generators[0].list.elements.find((el: any) => el.cluster === 'prod')) {
            return
        }
        data.spec.generators[0].list.elements.push({
                            "cluster": "prod",
                            "url": "https://kubernetes.default.svc"
                        });
        const putBody = {
            branch: 'master',
            content: Buffer.from(YAML.stringify(data)).toString('base64'),
            message: `add prod to applicationSet for ${name}`,
            sha: resBody.sha
        }

        await sendRequest(url, type, JSON.stringify(putBody));
    }
}

export const manageDroneFile = async (baseUrl: string, accessToken: string, name: string, env: 'dev' | 'prod') => {
    const url = `${baseUrl}/api/v1/repos/otomi-admin/${name}/contents/.drone.yml?access_token=${accessToken}`;

    const res = await sendRequest(url, 'get', null);

    const body = await res?.json();
    let data:any;
    
    if (env == 'dev') {
        data = {
            "kind": "pipeline",
            "type": "kubernetes",
            "name": "update-docker-dev",
            "clone": {
                "disable": true
            },
            "steps": [
                {
                "name": "clone-workload",
                "image": "plugins/git",
                "commands": [
                    "git clone https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git ."
                ]
                },
                {
                "name": "update-docker-tag",
                "image": "alpine/git",
                "commands": [
                    `sed -i 's/${name}:.*/${name}:'"${"${DRONE_BUILD_NUMBER}"}"'/g' ./${name}-dev/deployment.yaml`
                ]
                },
                {
                "name": "git-config",
                "image": "alpine/git",
                "commands": [
                    "git config --global user.name \"Drone CI\"",
                    "git config --global user.email \"bot@drone.com\""
                ]
                },
                {
                "name": "git-push",
                "image": "appleboy/drone-git-push",
                "settings": {
                    "branch": "master",
                    "remote": "https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git",
                    "username": {
                        "from_secret": "GIT_USERNAME"
                    },
                    "password": {
                        "from_secret": "GIT_PASSWORD"
                    },
                    "force": true,
                    "commit": true,
                    "commit_message": `Update ${name}-dev with docker image ${"${DRONE_BUILD_NUMBER}"}`,
                    "author_name": "droneCI",
                    "author_email": "gitea@local.domain"
                }
                }
            ],
            "depends_on": [
                "build"
            ]
            }
    } else {
        data = {
            "kind": "pipeline",
            "type": "kubernetes",
            "name": "update-docker-prod",
            "clone": {
                "disable": true
            },
            "steps": [
                {
                "name": "clone-workload",
                "image": "plugins/git",
                "commands": [
                    "git clone https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git ."
                ]
                },
                {
                "name": "update-docker-tag",
                "image": "alpine/git",
                "commands": [
                    `sed -i 's/${name}:.*/${name}:'"${"${DRONE_BUILD_NUMBER}"}"'/g' ./${name}-prod/deployment.yaml`
                ]
                },
                {
                "name": "git-config",
                "image": "alpine/git",
                "commands": [
                    "git config --global user.name \"Drone CI\"",
                    "git config --global user.email \"bot@drone.com\""
                ]
                },
                {
                "name": "git-push",
                "image": "appleboy/drone-git-push",
                "settings": {
                    "branch": "master",
                    "remote": "https://gitea.134.209.138.125.nip.io/otomi/argo-workload.git",
                    "username": {
                        "from_secret": "GIT_USERNAME"
                    },
                    "password": {
                        "from_secret": "GIT_PASSWORD"
                    },
                    "force": true,
                    "commit": true,
                    "commit_message": `Update ${name}-prod with docker image ${"${DRONE_BUILD_NUMBER}"}`,
                    "author_name": "droneCI",
                    "author_email": "gitea@local.domain"
                }
                }
            ],
            "trigger": {
                "branch": [
                "master"
                ]
            },
            "depends_on": [
                "update-docker-dev"
            ]
        }
    }
    const decodedString1 = Buffer.from(body.content, 'base64').toString('ascii');
    const decodedString2 = '---\n' + YAML.stringify(data);
    const concatenatedString = Buffer.from(`${decodedString1}\n${decodedString2}`).toString('base64');

    const putBody = {
        branch: 'master',
        content: concatenatedString,
        message: `add cd for ${env == 'dev' ? 'development' : 'production'} to pipeline`,
        sha: body.sha
    }

    await sendRequest(url, 'PUT', JSON.stringify(putBody));

}

export const createServiceMonitor = async (baseUrl: string, accessToken: string, name: string, env: 'prod' | 'dev') => {
    const fullName = `${name}-${env}`
    const url = `${baseUrl}/api/v1/repos/otomi/argo-workload/contents/${fullName}/servicemonitor.yaml?access_token=${accessToken}`
    const data = {
        "apiVersion": "monitoring.coreos.com/v1",
        "kind": "ServiceMonitor",
        "metadata": {
            "name": fullName,
            "labels": {
            "app": `${fullName}-metrics`,
            "prometheus": "system"
            }
        },
        "spec": {
            "namespaceSelector": {
            "matchNames": [
                fullName
            ]
            },
            "selector": {
            "matchLabels": {
                "app": fullName
            }
            },
            "endpoints": [
            {
                "targetPort": 5000,
                "path": "/metrics",
                "interval": "10s"
            }
            ]
        }
    }

    const body = createContent(data);
    
    await sendRequest(url, 'POST', body)
}
