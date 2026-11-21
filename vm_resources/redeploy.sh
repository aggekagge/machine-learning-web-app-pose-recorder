#!/bin/bash

set -e

echo "list running application"
sudo docker ps

echo "shutdown applications"
sudo docker compose down

echo "pull new images from the GitLab container registry"
sudo docker compose pull

echo  "deploy the application"
sudo docker compose up -d

echo "Successfully deployed application"