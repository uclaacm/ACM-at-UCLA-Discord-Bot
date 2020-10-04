#!/bin/bash

full_path=$(realpath $0)
project_root=$(dirname $(dirname full_path))

mkdir -p "$project_root/output"

sqlite3 -header -csv "$project_root/userinfo.db" "select * from users;" > "$project_root/output/users.csv"
