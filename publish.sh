#!/bin/bash

for relativefilepath in packages/*; do
    filename=`basename "${relativefilepath}"`
    echo "${filename} (${relativefilepath})"
    cd "${relativefilepath}"
    # --dry-run
    npm publish --access public --tag=next .
    cd - &> /dev/null
done