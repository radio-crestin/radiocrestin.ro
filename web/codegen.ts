import { CodegenConfig } from "@graphql-codegen/cli";
import dotenv from "dotenv";

dotenv.config();

const config: CodegenConfig = {
  schema: {
    [process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://127.0.0.1:8080/graphql"]: {
      headers: {
        Authorization: `Authorization ${process.env.GRAPHQL_TOKEN || ""}`,
      },
    },
  },
  documents: ["src/**/*.tsx", "src/**/*.ts"],
  generates: {
    "./src/lib/graphql/": {
      preset: "client",
      presetConfig: {
        gqlTagName: "gql",
        fragmentMasking: false,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;