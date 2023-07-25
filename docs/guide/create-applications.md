# Create a new application

To give you a headstart in developing a new application, the platform offers golden paths that will provision a new application with the necessary tooling to give you the focus on coding instead of configurations.

## Provision application

In order to provision a new application you can go to the golden paths created by the platform. Here you can select the type of application you want to provision and the tool will create a git repository and necessary pipelines. 

## Sync the repository

To make sure that the platform will trigger the pipeline when you push your code you have to sync the repository to DroneCI. After provisioning the application you will get a link where you can sync the repository.

## Push code

If you want to change the code or append new functions to the application, you can work locally and push code once you think it can be updated. As soon as you push code it will trigger the CI pipeline and a docker container is created and stored in Harbor. 