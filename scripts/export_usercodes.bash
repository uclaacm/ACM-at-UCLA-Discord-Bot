#!/bin/bash

full_path=$(realpath $0)
project_root=$(realpath $(dirname $(dirname $(realpath $full_path))))

mkdir -p "$project_root/output"

sqlite3 -header -csv "$project_root/userinfo.db" "select * from usercodes;" > "$project_root/output/usercodes.csv"
