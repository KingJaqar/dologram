DESCRIPTION
  Generate types from Postgres schema.

USAGE
  supabase gen types [flags]

FLAGS
  --local                          Generate types from the local dev database.
  --linked                         Generate types from the linked project.
  --db-url string                  Generate types from a database url.
  --project-id string              Generate types from a project ID.
  --lang choice                    Output language of the generated types. (default typescript) (choices: typescript, go, swift, python)
  --schema, -s string              Comma separated list of schema to include.
  --swift-access-control choice    Access control for Swift generated types. (default internal) (choices: internal, public)
  --postgrest-v9-compat            Generate types compatible with PostgREST v9 and below.
  --query-timeout string           Maximum timeout allowed for the database query. (default 15s)

GLOBAL FLAGS
  --help, -h                                                          Show help information
  --version, -v                                                       Show version information
  --completions <bash|zsh|fish|sh>                                    Print shell completion script (choices: bash, zsh, fish, sh)
  --log-level <all|trace|debug|info|warn|warning|error|fatal|none>    Sets the minimum log level (choices: all, trace, debug, info, warn, warning, error, fatal, none)
  --output-format choice                                              Output format: text (default), json, or stream-json (NDJSON) (choices: text, json, stream-json)
  --output, -o choice                                                 Output format of status variables. (choices: env, pretty, json, toml, yaml, table, csv)
  --profile string                                                    Use a specific profile for connecting to Supabase API.
  --debug                                                             Output debug logs to stderr.
  --workdir string                                                    Path to a Supabase project directory.
  --experimental                                                      Enable experimental features.
  --network-id string                                                 Use the specified Docker network instead of a generated one.
  --yes                                                               Answer yes to all prompts.
  --dns-resolver choice                                               Look up domain names using the specified resolver. (choices: native, https)
  --create-ticket                                                     Create a support ticket for any CLI error.
  --agent choice                                                      Override agent detection: yes, no, or auto (default auto). (choices: auto, yes, no)

EXAMPLES
  # Generate types from the local dev database
  supabase gen types --local

  # Generate Go types from the linked project
  supabase gen types --linked --lang=go

  # Generate types from a project ID with specific schemas
  supabase gen types --project-id abc-def-123 --schema public --schema private

  # Generate types from a database URL
  supabase gen types --db-url 'postgresql://...' --schema public --schema auth
