#!/bin/bash

full_path=$(realpath $0)

project_root=$(realpath $(dirname $(dirname $(realpath $full_path))))

mkdir -p "$project_root/backup"

sqlite3 "$project_root/userinfo.db" .dump > "$project_root/backup/userinfo.bak"

