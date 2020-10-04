#!/bin/bash

full_path=$(realpath $0)
project_root=$(dirname $(dirname full_path))

$project_root/scripts/export_users.bash

$project_root/scripts/export_usercodes.bash

$project_root/scripts/export_messages.bash

