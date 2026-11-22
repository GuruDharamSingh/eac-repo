// The one door for page changes (lane DOOR, contract C2: steps), as the Sites door imports it.
//
// Relative on purpose: apps/development does not list @elkdonis/house-editor as a dependency yet, so the
// package name does not resolve here (the PM runs the install). Once "@elkdonis/house-editor": "workspace:*" is
// in this app's package.json and installed, change this file to `export * from "@elkdonis/house-editor/steps";`
// and nothing else moves. Pure and server-safe: no React, no DOM, no database.
export * from "../../../../packages/house-editor/src/steps/index";
