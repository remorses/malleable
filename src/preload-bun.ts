import { plugin } from "bun";
import { createEsmShPlugin } from "./esm-https-plugin.ts";

plugin(
  createEsmShPlugin({
    externalPackages: ["react", "react-dom", "react/jsx-runtime"],
  }) as any,
);
