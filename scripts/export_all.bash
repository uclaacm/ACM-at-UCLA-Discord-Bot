#!/bin/bash

full_path=$(realpath $0)
project_root=$(realpath $(dirname $(dirname $(realpath export_all.bash))))

$project_root/scripts/export_users.bash

$project_root/scripts/export_usercodes.bash

$project_root/scripts/export_messages.bash

