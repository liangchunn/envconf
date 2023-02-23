# envconf

An interactive command line interface for setting up and syncing env files based on a template

## Usage
```sh
# set up or sync env files from `envconf.toml`
# (by default it will look it up on the cwd)
envconf

# help
envconf --help
```

## Configuration

Create a `envconf.toml` file with the following format:

```toml
[files]

[files.example1]
template = "./test/example1/.env.sample"
output = "./test/example1/.env"
allow-empty = ["IGNORED_ENV"]
force-prompt-on-create = ["FORCED_PROMPT_WITH_DEFAULT_VALUE"]

[files.example2]
template = "./test/example2/.env.local.sample"
output = "./test/example2/.env.local"
```

### Fields
- `template`: the template file which the env file should be generated from
- `output`: the output env file which will be generated
- `allow-empty`
  - Ignores the envs on creation and copies it as-is with the value set to an empty string
  - If the output file already exists and does not contain the variables specified in `allow-empty`, it will prompt to fill in as blank
- `force-prompt-on-create`: forces a prompt on create for the given env variables even though they have default values

## Behaviours
### On creation of the env file
- Prompts for all env variables which do not have default value in the template
- Env variables which are inside `allow-empty` will be automatically copied with the value set to empty

### On sync (existing env file)
- Prompts for all missing env variables from the template file which are not in the output file
- If there is a default value for an env variable which is not set, pressing ENTER when prompted will fill in the default value
- If an env variable is inside `allow-empty` and is not set, it will prompt to add it as empty to the output file