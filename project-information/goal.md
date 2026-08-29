Goal as well as constraint

I want my final workflow are like
1. Put repo public manually by human (me)
2. Paste docker-stack.yml (docker swarm) in Portainer
3. Deploy stack
4. Put repo to private manually by human (me)
5. So entrypoint doing everything all in one
    - If not installed, then install
    - If installed, then just start it
    - Do not auto update our app
    - Entrypoint in docker stack only do simple logic, the heavylifting done in entrypoint.sh (entrypoint docker-stack.yml -> entrypoint.sh)
6. The entrypoint get its data from repo (wget/curl)
7. So that's i dont have to juggling with .env anymore
8. 1 click install with entrypoint
