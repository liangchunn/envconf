#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import fs from "fs";
import toml from "toml";
import dotenv from "dotenv";
import inquirer from "inquirer";
import chalk from "chalk";

type ConfigFile = Record<
  "files",
  Record<
    string,
    {
      template: string;
      output: string;
      "allow-empty": string[] | undefined;
      "force-prompt-on-create": string[] | undefined;
    }
  >
>;

async function main() {
  const args = await yargs(hideBin(process.argv))
    .option("config", {
      alias: "c",
      type: "string",
      description: ".toml config file",
      default: "envconf.toml",
    })
    .demandOption("config")
    .strictCommands()
    .parse();

  const configPath = args.config;
  const resolvedConfigPath = path.resolve(process.cwd(), configPath);

  const configFile = fs.readFileSync(resolvedConfigPath, { encoding: "utf-8" });
  const parsedConfigFile: ConfigFile = toml.parse(configFile);

  const keys = Object.keys(parsedConfigFile.files);

  for (const key of keys) {
    const config = parsedConfigFile.files[key];
    const ignoreKeys = config["allow-empty"] ?? [];
    const forcedKeys = config["force-prompt-on-create"] ?? [];
    const outputFilePath = path.resolve(
      resolvedConfigPath,
      "..",
      config.output
    );
    const exists = fs.existsSync(outputFilePath);
    const relativePath = path.relative(process.cwd(), outputFilePath);
    if (exists) {
      const templateFilePath = path.resolve(
        resolvedConfigPath,
        "..",
        config.template
      );
      const templateFileContents = fs.readFileSync(templateFilePath, {
        encoding: "utf-8",
      });
      const outputFileContents = fs.readFileSync(outputFilePath, {
        encoding: "utf-8",
      });
      const parsedTemplateEnv = dotenv.parse(templateFileContents);
      const parsedOutputEnv = dotenv.parse(outputFileContents);

      // if there's a template env which doesn't exist in the output env
      const keysNotInOutput = Object.keys(parsedTemplateEnv).filter(
        (x) => !Object.keys(parsedOutputEnv).includes(x)
      );

      /**
       * handled cases:
       * 1. template has an env var which is supposed to be filled out
       * 2. template has an env var with the default value but not filled out
       * 3. template has an env var which is "allow-empty" but not existing in .env
       */

      if (keysNotInOutput.length) {
        console.log(
          chalk.yellow(
            `${config.output} is missing ${keysNotInOutput.length} environment variables.`
          )
        );
        const questions = keysNotInOutput.map((envVar) => {
          const isAllowEmpty = ignoreKeys.includes(envVar);
          const defaultValue = parsedTemplateEnv[envVar];
          if (isAllowEmpty) {
            return {
              message: `Populate ${envVar} with the default value (empty string)?`,
              name: envVar,
              type: "confirm",
            };
          } else {
            return {
              message: `Enter the value for ${envVar}:`,
              name: envVar,
              type: "input",
              default: defaultValue.length ? defaultValue : undefined,
            };
          }
        });
        const answers = await inquirer.prompt(questions);
        // update the output file
        const outputFile = updateExistingOutput(outputFileContents, answers);
        fs.writeFileSync(outputFilePath, outputFile, { encoding: "utf-8" });
        console.log(chalk.greenBright(`Successfully updated ${relativePath}`));
      } else {
        console.log(chalk.gray(`${relativePath} is synced with its template`));
      }
    } else {
      const templateFilePath = path.resolve(
        resolvedConfigPath,
        "..",
        config.template
      );
      const templateFileContents = fs.readFileSync(templateFilePath, {
        encoding: "utf-8",
      });
      const envVars = dotenv.parse(templateFileContents);
      // get all env vars which are unpopulated in the env file OR matches the overrides
      // and ignore the keys which should be left empty by default
      const envVarKeys = Object.entries(envVars)
        .filter(
          ([key, value]) =>
            (value === "" || forcedKeys.includes(key)) &&
            !ignoreKeys.includes(key)
        )
        .map(([key]) => key);

      const templateRelativePath = path.relative(
        process.cwd(),
        templateFilePath
      );
      console.log(chalk.cyan(`Configuring env from ${templateRelativePath}`));

      const questions = envVarKeys.map((envVar) => ({
        message: `Enter the value for ${envVar}:`,
        name: envVar,
        type: "input",
      }));
      const answers = await inquirer.prompt(questions);
      const outputFile = populateTemplate(templateFileContents, answers);
      fs.writeFileSync(outputFilePath, outputFile, { encoding: "utf-8" });
      console.log(chalk.green(`Successfully created ${relativePath}\n`));
    }
  }
}

function populateTemplate(
  templateString: string,
  variables: Record<string, string>
) {
  let sink = templateString;

  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`${key}=(.*)`);
    sink = sink.replace(pattern, `${key}=${value}`);
  }

  return sink;
}

function updateExistingOutput(
  outputString: string,
  variables: Record<string, string>
) {
  let sink = outputString.trim();
  sink += "\n";
  for (const [key, value] of Object.entries(variables)) {
    // if the value is a boolean and is true, it means that we want to populate the default empty value
    if (typeof value === "boolean") {
      if (value === true) {
        sink += `${key}=\n`;
      }
    } else {
      sink += `${key}=${value}\n`;
    }
  }
  return sink;
}

main();
