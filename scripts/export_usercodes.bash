#!/bin/bash

full_path=$(realpath $0)
project_root=$(realpath $(dirname $(dirname $(realpath export_all.bash))))

mkdir -p "$project_root/output"

sqlite3 -header -csv "$project_root/userinfo.db" "select * from usercodes;" > "$project_root/output/usercodes.csv"
