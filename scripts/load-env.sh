#!/bin/sh
# Load azd environment variables for local development
# Usage: source ./scripts/load-env.sh

echo "Loading azd environment variables..."

ENV_VALUES=$(azd env get-values 2>/dev/null)
if [ -z "$ENV_VALUES" ]; then
    echo "Warning: No azd environment found. Run 'azd env new <name>' first."
    return 1 2>/dev/null || exit 1
fi

while IFS= read -r line; do
    line=$(echo "$line" | xargs)
    if [ -n "$line" ] && [ "${line#\#}" = "$line" ]; then
        key=$(echo "$line" | cut -d= -f1)
        value=$(echo "$line" | cut -d= -f2- | sed 's/^"//;s/"$//')
        export "$key=$value"
        echo "  $key = $(echo "$value" | cut -c1-40)$([ ${#value} -gt 40 ] && echo '...')"
    fi
done <<< "$ENV_VALUES"

echo ""
echo "Environment loaded. You can now run the API locally with SESSION_STRATEGY=azure."
