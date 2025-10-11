#!/bin/sh
# Helper script used by gitCommandsService to feed GitHub tokens to git when
# pushing or pulling. Git invokes this script with a prompt; we return the
# token provided through the GITHUB_ACCESS_TOKEN environment variable.

if [ "$1" = "Username for 'https://github.com':" ]; then
  echo "x-access-token"
  exit 0
fi

if [ -n "$GITHUB_ACCESS_TOKEN" ]; then
  echo "$GITHUB_ACCESS_TOKEN"
  exit 0
fi

echo "" 
exit 0
