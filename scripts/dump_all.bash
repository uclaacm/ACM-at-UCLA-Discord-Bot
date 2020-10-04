#!/bin/bash

full_path=$(realpath $0)
project_root=$(realpath $(dirname $(dirname $(realpath export_all.bash))))

mkdir -p "$project_root/backup"

sqlite3 "$project_root/userinfo.db" .dump > "$project_root/backup/userinfo.bak"

