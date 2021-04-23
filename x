#!/bin/bash

cd $(dirname $0)
export USER_ID="${USER_ID:-$UID}"

case "$1" in
"node")
    if [ "$w" != "" ]; then
        docker-compose exec -w "/work/$w" node ${@:2:($#-1)}
    else
        docker-compose exec node ${@:2:($#-1)}
    fi
    ;;
*)
    docker-compose $*
    ;;
esac